import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number; // Número máximo de requisições
  window: number; // Janela de tempo em segundos
  skipIf?: (request: any) => boolean; // Função para pular o rate limiting
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (options: RateLimitOptions) => 
  SetMetadata(RATE_LIMIT_KEY, options);