import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/database/prisma.service';
import { User } from '@prisma/client';

export interface RefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly redis: Redis;
  private readonly defaultExpiration: number;
  private readonly extendedExpiration: number;
  private readonly maxTokensPerUser: number;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private prisma: PrismaService,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB') || 0,
    });
    
    this.defaultExpiration = this.configService.get<number>('REFRESH_TOKEN_EXPIRATION') || 604800; // 7 dias
    this.extendedExpiration = this.configService.get<number>('REFRESH_TOKEN_EXTENDED_EXPIRATION') || 2592000; // 30 dias
    this.maxTokensPerUser = this.configService.get<number>('MAX_REFRESH_TOKENS_PER_USER') || 10;
  }

  async storeRefreshToken(
    user: User,
    refreshToken: string,
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const tokenHash = this.hashToken(refreshToken);
      const expiration = rememberMe ? this.extendedExpiration : this.defaultExpiration;
      const expiresAt = new Date(Date.now() + expiration * 1000);
      
      const refreshTokenData: RefreshTokenData = {
        userId: user.id,
        tokenHash,
        expiresAt,
        createdAt: new Date(),
        ipAddress,
        userAgent,
      };

      // Armazenar no Redis
      const redisKey = this.getRedisKey(user.id, tokenHash);
      await this.redis.setex(
        redisKey,
        expiration,
        JSON.stringify(refreshTokenData),
      );

      // Adicionar à lista de tokens do usuário
      const userTokensKey = this.getUserTokensKey(user.id);
      await this.redis.zadd(userTokensKey, Date.now(), tokenHash);
      
      // Limpar tokens antigos se necessário
      await this.cleanupOldTokens(user.id);

      this.logger.debug(
        `Refresh token armazenado para usuário ${user.email}`,
        'RefreshTokenService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao armazenar refresh token para usuário ${user.email}: ${error.message}`,
        'RefreshTokenService',
      );
      throw error;
    }
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(refreshToken);
      const redisKey = this.getRedisKey(userId, tokenHash);
      
      const tokenDataStr = await this.redis.get(redisKey);
      
      if (!tokenDataStr) {
        this.logger.debug(
          `Refresh token não encontrado para usuário ${userId}`,
          'RefreshTokenService',
        );
        return false;
      }

      const tokenData = JSON.parse(tokenDataStr) as RefreshTokenData;
      
      // Verificar se não expirou
      if (new Date() > new Date(tokenData.expiresAt)) {
        this.logger.debug(
          `Refresh token expirado para usuário ${userId}`,
          'RefreshTokenService',
        );
        await this.revokeRefreshToken(userId, refreshToken);
        return false;
      }

      // Atualizar last used
      tokenData.lastUsedAt = new Date();
      const ttl = await this.redis.ttl(redisKey);
      
      if (ttl > 0) {
        await this.redis.setex(
          redisKey,
          ttl,
          JSON.stringify(tokenData),
        );
      }

      this.logger.debug(
        `Refresh token válido para usuário ${userId}`,
        'RefreshTokenService',
      );
      
      return true;
    } catch (error) {
      this.logger.error(
        `Erro ao validar refresh token para usuário ${userId}: ${error.message}`,
        'RefreshTokenService',
      );
      return false;
    }
  }

  async revokeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    try {
      const tokenHash = this.hashToken(refreshToken);
      const redisKey = this.getRedisKey(userId, tokenHash);
      const userTokensKey = this.getUserTokensKey(userId);
      
      // Remover do Redis
      await this.redis.del(redisKey);
      
      // Remover da lista de tokens do usuário
      await this.redis.zrem(userTokensKey, tokenHash);
      
      this.logger.debug(
        `Refresh token revogado para usuário ${userId}`,
        'RefreshTokenService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao revogar refresh token para usuário ${userId}: ${error.message}`,
        'RefreshTokenService',
      );
    }
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    try {
      const userTokensKey = this.getUserTokensKey(userId);
      const tokenHashes = await this.redis.zrange(userTokensKey, 0, -1);
      
      if (tokenHashes.length === 0) {
        return;
      }

      // Remover todos os tokens
      const deletePromises = tokenHashes.map(tokenHash => {
        const redisKey = this.getRedisKey(userId, tokenHash);
        return this.redis.del(redisKey);
      });
      
      await Promise.all(deletePromises);
      
      // Limpar lista de tokens do usuário
      await this.redis.del(userTokensKey);
      
      this.logger.info(
        `Todos os refresh tokens revogados para usuário ${userId}`,
        'RefreshTokenService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao revogar todos os refresh tokens para usuário ${userId}: ${error.message}`,
        'RefreshTokenService',
      );
    }
  }

  async getUserActiveTokens(userId: string): Promise<RefreshTokenData[]> {
    try {
      const userTokensKey = this.getUserTokensKey(userId);
      const tokenHashes = await this.redis.zrange(userTokensKey, 0, -1);
      
      const tokens: RefreshTokenData[] = [];
      
      for (const tokenHash of tokenHashes) {
        const redisKey = this.getRedisKey(userId, tokenHash);
        const tokenDataStr = await this.redis.get(redisKey);
        
        if (tokenDataStr) {
          const tokenData = JSON.parse(tokenDataStr) as RefreshTokenData;
          
          // Converter strings de data de volta para objetos Date
          tokenData.expiresAt = new Date(tokenData.expiresAt);
          tokenData.createdAt = new Date(tokenData.createdAt);
          if (tokenData.lastUsedAt) {
            tokenData.lastUsedAt = new Date(tokenData.lastUsedAt);
          }
          
          tokens.push(tokenData);
        }
      }
      
      return tokens;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar tokens ativos para usuário ${userId}: ${error.message}`,
        'RefreshTokenService',
      );
      return [];
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      // Esta função pode ser executada periodicamente
      // O Redis já faz expiração automática, mas podemos fazer limpeza adicional
      this.logger.debug('Limpeza de tokens expirados executada', 'RefreshTokenService');
    } catch (error) {
      this.logger.error(
        `Erro na limpeza de tokens expirados: ${error.message}`,
        'RefreshTokenService',
      );
    }
  }

  private async cleanupOldTokens(userId: string): Promise<void> {
    try {
      const userTokensKey = this.getUserTokensKey(userId);
      const tokenCount = await this.redis.zcard(userTokensKey);
      
      if (tokenCount > this.maxTokensPerUser) {
        // Remover tokens mais antigos
        const excessCount = tokenCount - this.maxTokensPerUser;
        const oldTokenHashes = await this.redis.zrangebyscore(
          userTokensKey,
          '-inf',
          '+inf',
          'LIMIT', 0, excessCount
        );
        
        for (const tokenHash of oldTokenHashes) {
          const redisKey = this.getRedisKey(userId, tokenHash);
          await this.redis.del(redisKey);
          await this.redis.zrem(userTokensKey, tokenHash);
        }
        
        this.logger.debug(
          `Removidos ${excessCount} refresh tokens antigos para usuário ${userId}`,
          'RefreshTokenService',
        );
      }
    } catch (error) {
      this.logger.error(
        `Erro ao limpar tokens antigos para usuário ${userId}: ${error.message}`,
        'RefreshTokenService',
      );
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRedisKey(userId: string, tokenHash: string): string {
    return `refresh_token:${userId}:${tokenHash}`;
  }

  private getUserTokensKey(userId: string): string {
    return `user_refresh_tokens:${userId}`;
  }
}