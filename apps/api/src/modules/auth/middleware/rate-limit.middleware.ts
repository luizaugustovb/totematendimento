import { 
  Injectable, 
  NestMiddleware, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { LoggerService } from '../../../common/logger/logger.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

interface RateLimitInfo {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly redis: Redis;

  constructor(
    private reflector: Reflector,
    private logger: LoggerService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
    });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Obter opções de rate limit dos metadados da rota
      const rateLimitOptions = this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_KEY,
        req.route?.stack?.[0]?.handle,
      );

      if (!rateLimitOptions) {
        return next();
      }

      // Verificar se deve pular o rate limiting
      if (rateLimitOptions.skipIf && rateLimitOptions.skipIf(req)) {
        return next();
      }

      // Gerar chave única baseada no IP e rota
      const key = this.generateKey(req, rateLimitOptions);
      
      // Verificar e atualizar contadores
      const rateLimitInfo = await this.checkRateLimit(key, rateLimitOptions);

      // Adicionar headers de rate limit na resposta
      this.addRateLimitHeaders(res, rateLimitInfo, rateLimitOptions);

      if (rateLimitInfo.isBlocked) {
        this.logger.warn(
          `Rate limit excedido para ${req.ip} na rota ${req.path}`,
          'RateLimitMiddleware',
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Muitas requisições. Tente novamente mais tarde.',
            retryAfter: Math.ceil(rateLimitInfo.timeToExpire / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Erro no middleware de rate limiting: ${error.message}`,
        'RateLimitMiddleware',
      );
      
      // Em caso de erro, permitir a requisição para não bloquear o sistema
      next();
    }
  }

  private generateKey(req: Request, options: RateLimitOptions): string {
    const ip = req.ip || req.connection.remoteAddress;
    const route = req.route?.path || req.path;
    const method = req.method;
    
    // Incluir user ID se disponível para rate limiting por usuário
    const userId = (req as any).user?.id;
    const userPart = userId ? `:${userId}` : '';
    
    return `rate_limit:${ip}:${method}:${route}${userPart}:${options.window}`;
  }

  private async checkRateLimit(
    key: string,
    options: RateLimitOptions,
  ): Promise<RateLimitInfo> {
    const windowSizeInMs = options.window * 1000;
    const now = Date.now();
    const windowStart = now - windowSizeInMs;

    // Usar Redis para implementar sliding window
    const multi = this.redis.multi();
    
    // Remover entradas antigas
    multi.zremrangebyscore(key, '-inf', windowStart);
    
    // Adicionar entrada atual
    multi.zadd(key, now, now);
    
    // Contar entradas na janela atual
    multi.zcard(key);
    
    // Definir expiração da chave
    multi.expire(key, Math.ceil(windowSizeInMs / 1000));
    
    // Obter TTL da chave
    multi.ttl(key);

    const results = await multi.exec();
    
    if (!results || results.some(([err]) => err)) {
      throw new Error('Erro ao verificar rate limit no Redis');
    }

    const totalHits = results[2][1] as number; // Resultado do ZCARD
    const ttl = results[4][1] as number; // Resultado do TTL
    const timeToExpire = ttl * 1000; // Converter para milissegundos
    const isBlocked = totalHits > options.limit;

    return {
      totalHits,
      timeToExpire,
      isBlocked,
    };
  }

  private addRateLimitHeaders(
    res: Response,
    rateLimitInfo: RateLimitInfo,
    options: RateLimitOptions,
  ): void {
    res.setHeader('X-RateLimit-Limit', options.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.limit - rateLimitInfo.totalHits));
    res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + rateLimitInfo.timeToExpire) / 1000));
    
    if (rateLimitInfo.isBlocked) {
      res.setHeader('Retry-After', Math.ceil(rateLimitInfo.timeToExpire / 1000));
    }
  }
}