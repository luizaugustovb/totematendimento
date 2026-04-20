import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.conectar();
  }

  private conectar(): void {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
      
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.logger.log('Conectado ao Redis');
      });

      this.redis.on('error', (error) => {
        this.logger.error('Erro na conexão Redis:', error);
      });

      this.redis.on('close', () => {
        this.logger.warn('Conexão Redis fechada');
      });

      // Conectar imediatamente
      this.redis.connect().catch(error => {
        this.logger.error('Falha na conexão inicial com Redis:', error);
      });

    } catch (error) {
      this.logger.error('Erro ao configurar Redis:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.logger.log('Redis desconectado');
    }
  }

  // OPERAÇÕES BÁSICAS DE CACHE

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Erro ao buscar chave ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        const resultado = await this.redis.setex(key, ttlSeconds, value);
        return resultado === 'OK';
      } else {
        const resultado = await this.redis.set(key, value);
        return resultado === 'OK';
      }
    } catch (error) {
      this.logger.error(`Erro ao definir chave ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const resultado = await this.redis.del(key);
      return resultado > 0;
    } catch (error) {
      this.logger.error(`Erro ao deletar chave ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const resultado = await this.redis.exists(key);
      return resultado > 0;
    } catch (error) {
      this.logger.error(`Erro ao verificar existência da chave ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const resultado = await this.redis.expire(key, ttlSeconds);
      return resultado === 1;
    } catch (error) {
      this.logger.error(`Erro ao definir expiração da chave ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Erro ao obter TTL da chave ${key}:`, error);
      return -1;
    }
  }

  // OPERAÇÕES COM OBJETOS (JSON)

  async getObject<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Erro ao buscar objeto ${key}:`, error);
      return null;
    }
  }

  async setObject(key: string, obj: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const value = JSON.stringify(obj);
      return await this.set(key, value, ttlSeconds);
    } catch (error) {
      this.logger.error(`Erro ao definir objeto ${key}:`, error);
      return false;
    }
  }

  // OPERAÇÕES COM LISTAS

  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis.lpush(key, ...values);
    } catch (error) {
      this.logger.error(`Erro ao fazer lpush na chave ${key}:`, error);
      return 0;
    }
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis.rpush(key, ...values);
    } catch (error) {
      this.logger.error(`Erro ao fazer rpush na chave ${key}:`, error);
      return 0;
    }
  }

  async lpop(key: string): Promise<string | null> {
    try {
      return await this.redis.lpop(key);
    } catch (error) {
      this.logger.error(`Erro ao fazer lpop na chave ${key}:`, error);
      return null;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.redis.rpop(key);
    } catch (error) {
      this.logger.error(`Erro ao fazer rpop na chave ${key}:`, error);
      return null;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.redis.lrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Erro ao fazer lrange na chave ${key}:`, error);
      return [];
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.redis.llen(key);
    } catch (error) {
      this.logger.error(`Erro ao obter llen da chave ${key}:`, error);
      return 0;
    }
  }

  // OPERAÇÕES COM SETS

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Erro ao fazer sadd na chave ${key}:`, error);
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Erro ao fazer srem na chave ${key}:`, error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      this.logger.error(`Erro ao obter smembers da chave ${key}:`, error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const resultado = await this.redis.sismember(key, member);
      return resultado === 1;
    } catch (error) {
      this.logger.error(`Erro ao verificar sismember na chave ${key}:`, error);
      return false;
    }
  }

  // OPERAÇÕES COM HASH

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      const resultado = await this.redis.hset(key, field, value);
      return resultado >= 0;
    } catch (error) {
      this.logger.error(`Erro ao fazer hset na chave ${key}:`, error);
      return false;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis.hget(key, field);
    } catch (error) {
      this.logger.error(`Erro ao fazer hget na chave ${key}:`, error);
      return null;
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await this.redis.hdel(key, ...fields);
    } catch (error) {
      this.logger.error(`Erro ao fazer hdel na chave ${key}:`, error);
      return 0;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redis.hgetall(key);
    } catch (error) {
      this.logger.error(`Erro ao fazer hgetall na chave ${key}:`, error);
      return {};
    }
  }

  // RATE LIMITING

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ 
    allowed: boolean; 
    remaining: number; 
    resetTime: number; 
  }> {
    try {
      const now = Date.now();
      const window = Math.floor(now / (windowSeconds * 1000));
      const rateLimitKey = `rate_limit:${key}:${window}`;

      const current = await this.redis.incr(rateLimitKey);
      
      if (current === 1) {
        // Primeira requisição nesta janela, definir expiração
        await this.redis.expire(rateLimitKey, windowSeconds);
      }

      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const resetTime = (window + 1) * windowSeconds * 1000;

      return { allowed, remaining, resetTime };

    } catch (error) {
      this.logger.error(`Erro no rate limiting para ${key}:`, error);
      // Em caso de erro, permitir a requisição
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + windowSeconds * 1000 };
    }
  }

  // CACHE INTELIGENTE COM TTL VARIÁVEL

  async cacheOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds = 300,
    refreshThreshold = 0.8
  ): Promise<T> {
    try {
      // Tentar buscar do cache primeiro
      const cached = await this.getObject<{ data: T; timestamp: number }>(key);
      
      if (cached) {
        const age = (Date.now() - cached.timestamp) / 1000;
        const maxAge = ttlSeconds * refreshThreshold;
        
        if (age < maxAge) {
          // Cache ainda fresco
          return cached.data;
        } else {
          // Cache antigo mas ainda válido, renovar em background
          this.renovarCacheBackground(key, computeFn, ttlSeconds);
          return cached.data;
        }
      }

      // Cache miss ou expirado, computar novo valor
      const data = await computeFn();
      const cacheData = { data, timestamp: Date.now() };
      
      await this.setObject(key, cacheData, ttlSeconds);
      return data;

    } catch (error) {
      this.logger.error(`Erro no cache inteligente para ${key}:`, error);
      
      // Tentar executar a função diretamente
      return await computeFn();
    }
  }

  private async renovarCacheBackground<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const data = await computeFn();
      const cacheData = { data, timestamp: Date.now() };
      await this.setObject(key, cacheData, ttlSeconds);
    } catch (error) {
      this.logger.error(`Erro ao renovar cache em background para ${key}:`, error);
    }
  }

  // UTILIDADES

  async ping(): Promise<boolean> {
    try {
      const resultado = await this.redis.ping();
      return resultado === 'PONG';
    } catch (error) {
      this.logger.error('Erro no ping Redis:', error);
      return false;
    }
  }

  async flushdb(): Promise<boolean> {
    try {
      // Apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        await this.redis.flushdb();
        this.logger.warn('Redis database limpo (apenas em desenvolvimento)');
        return true;
      } else {
        this.logger.warn('flushdb ignorado - não está em desenvolvimento');
        return false;
      }
    } catch (error) {
      this.logger.error('Erro ao limpar Redis:', error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.logger.error(`Erro ao buscar keys com pattern ${pattern}:`, error);
      return [];
    }
  }

  // Getter para instância Redis (para casos avançados)
  getClient(): Redis {
    return this.redis;
  }
}