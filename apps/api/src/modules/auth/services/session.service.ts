import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerService } from '../../../common/logger/logger.service';
import { User } from '@prisma/client';

export interface SessionData {
  userId: string;
  email: string;
  loginAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  rememberMe: boolean;
}

@Injectable()
export class SessionService {
  private readonly redis: Redis;
  private readonly sessionExpiration: number;
  private readonly maxSessionsPerUser: number;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB') || 0,
    });
    
    this.sessionExpiration = this.configService.get<number>('SESSION_EXPIRATION') || 86400; // 24 horas
    this.maxSessionsPerUser = this.configService.get<number>('MAX_SESSIONS_PER_USER') || 5;
  }

  async createSession(
    user: User,
    token: string,
    ipAddress?: string,
    userAgent?: string,
    rememberMe: boolean = false,
  ): Promise<string> {
    try {
      const sessionId = this.generateSessionId();
      const sessionKey = this.getSessionKey(sessionId);
      const userSessionsKey = this.getUserSessionsKey(user.id);
      
      const sessionData: SessionData = {
        userId: user.id,
        email: user.email,
        loginAt: new Date(),
        lastActivity: new Date(),
        ipAddress,
        userAgent,
        rememberMe,
      };

      // Armazenar sessão
      const expiration = rememberMe ? this.sessionExpiration * 30 : this.sessionExpiration;
      
      await this.redis.setex(
        sessionKey,
        expiration,
        JSON.stringify(sessionData),
      );

      // Mapear token para sessão
      const tokenKey = this.getTokenKey(token);
      await this.redis.setex(tokenKey, expiration, sessionId);

      // Adicionar sessão à lista do usuário
      await this.redis.zadd(userSessionsKey, Date.now(), sessionId);
      
      // Limpar sessões antigas se necessário
      await this.cleanupOldSessions(user.id);

      this.logger.info(
        `Sessão criada para usuário ${user.email}: ${sessionId}`,
        'SessionService',
      );

      return sessionId;
    } catch (error) {
      this.logger.error(
        `Erro ao criar sessão para usuário ${user.email}: ${error.message}`,
        'SessionService',
      );
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const sessionDataStr = await this.redis.get(sessionKey);
      
      if (!sessionDataStr) {
        return null;
      }

      const sessionData = JSON.parse(sessionDataStr) as SessionData;
      
      // Converter strings de data de volta para objetos Date
      sessionData.loginAt = new Date(sessionData.loginAt);
      sessionData.lastActivity = new Date(sessionData.lastActivity);

      return sessionData;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar sessão ${sessionId}: ${error.message}`,
        'SessionService',
      );
      return null;
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        return;
      }

      sessionData.lastActivity = new Date();
      
      const sessionKey = this.getSessionKey(sessionId);
      const ttl = await this.redis.ttl(sessionKey);
      
      if (ttl > 0) {
        await this.redis.setex(
          sessionKey,
          ttl,
          JSON.stringify(sessionData),
        );
      }
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar atividade da sessão ${sessionId}: ${error.message}`,
        'SessionService',
      );
    }
  }

  async isValidSession(userId: string, token: string): Promise<boolean> {
    try {
      const tokenKey = this.getTokenKey(token);
      const sessionId = await this.redis.get(tokenKey);
      
      if (!sessionId) {
        return false;
      }

      const sessionData = await this.getSession(sessionId);
      
      if (!sessionData || sessionData.userId !== userId) {
        return false;
      }

      // Atualizar atividade da sessão
      await this.updateSessionActivity(sessionId);
      
      return true;
    } catch (error) {
      this.logger.error(
        `Erro ao validar sessão para usuário ${userId}: ${error.message}`,
        'SessionService',
      );
      return false;
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        return;
      }

      const sessionKey = this.getSessionKey(sessionId);
      const userSessionsKey = this.getUserSessionsKey(sessionData.userId);
      
      // Remover sessão
      await this.redis.del(sessionKey);
      
      // Remover da lista do usuário
      await this.redis.zrem(userSessionsKey, sessionId);
      
      this.logger.info(
        `Sessão invalidada: ${sessionId}`,
        'SessionService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao invalidar sessão ${sessionId}: ${error.message}`,
        'SessionService',
      );
    }
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redis.zrange(userSessionsKey, 0, -1);
      
      if (sessionIds.length === 0) {
        return;
      }

      // Invalidar todas as sessões
      const promises = sessionIds.map(sessionId => 
        this.invalidateSession(sessionId)
      );
      
      await Promise.all(promises);
      
      // Limpar lista de sessões do usuário
      await this.redis.del(userSessionsKey);
      
      this.logger.info(
        `Todas as sessões invalidadas para usuário ${userId}`,
        'SessionService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao invalidar sessões do usuário ${userId}: ${error.message}`,
        'SessionService',
      );
    }
  }

  async getUserActiveSessions(userId: string): Promise<SessionData[]> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redis.zrange(userSessionsKey, 0, -1);
      
      const sessions: SessionData[] = [];
      
      for (const sessionId of sessionIds) {
        const sessionData = await this.getSession(sessionId);
        if (sessionData) {
          sessions.push(sessionData);
        }
      }
      
      return sessions;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar sessões do usuário ${userId}: ${error.message}`,
        'SessionService',
      );
      return [];
    }
  }

  private async cleanupOldSessions(userId: string): Promise<void> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionCount = await this.redis.zcard(userSessionsKey);
      
      if (sessionCount > this.maxSessionsPerUser) {
        // Remover sessões mais antigas
        const excessCount = sessionCount - this.maxSessionsPerUser;
        const oldSessionIds = await this.redis.zrangebyscore(
          userSessionsKey,
          '-inf',
          '+inf',
          'LIMIT', 0, excessCount
        );
        
        for (const sessionId of oldSessionIds) {
          await this.invalidateSession(sessionId);
        }
      }
    } catch (error) {
      this.logger.error(
        `Erro ao limpar sessões antigas para usuário ${userId}: ${error.message}`,
        'SessionService',
      );
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
  }

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  private getTokenKey(token: string): string {
    return `token:${token.slice(-20)}`; // Usar apenas os últimos 20 caracteres para economizar memória
  }
}