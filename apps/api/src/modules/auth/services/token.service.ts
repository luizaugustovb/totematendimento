import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { LoggerService } from '../../../common/logger/logger.service';
import { JwtPayload } from '../strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

@Injectable()
export class TokenService {
  private readonly accessTokenExpiration: string;
  private readonly refreshTokenExpiration: string;
  private readonly jwtSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.accessTokenExpiration = this.configService.get<string>('JWT_EXPIRATION') || '15m';
    this.refreshTokenExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret';
  }

  async generateTokenPair(
    user: User, 
    sessionId?: string,
    rememberMe: boolean = false
  ): Promise<TokenPair> {
    try {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        sessionId,
      };

      // Gerar Access Token
      const accessTokenPayload = { ...payload, tokenType: 'access' };
      const accessToken = await this.jwtService.signAsync(
        accessTokenPayload,
        {
          secret: this.jwtSecret,
          expiresIn: this.accessTokenExpiration,
        }
      );

      // Gerar Refresh Token (com expiração extendida se "lembrar-me" estiver ativo)
      const refreshTokenPayload = { ...payload, tokenType: 'refresh' };
      const refreshTokenExpiration = rememberMe ? '30d' : this.refreshTokenExpiration;
      
      const refreshToken = await this.jwtService.signAsync(
        refreshTokenPayload,
        {
          secret: this.refreshSecret,
          expiresIn: refreshTokenExpiration,
        }
      );

      // Calcular tempo de expiração em segundos
      const expiresIn = this.parseExpirationToSeconds(this.accessTokenExpiration);

      this.logger.debug(
        `Tokens gerados para usuário ${user.email}`,
        'TokenService',
      );

      return {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      this.logger.error(
        `Erro ao gerar tokens para usuário ${user.email}: ${error.message}`,
        'TokenService',
      );
      throw error;
    }
  }

  async verifyAccessToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwtSecret,
      });

      if (payload.tokenType !== 'access') {
        this.logger.warn(
          'Tentativa de usar token que não é de acesso',
          'TokenService',
        );
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.debug(
        `Token de acesso inválido: ${error.message}`,
        'TokenService',
      );
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshSecret,
      });

      if (payload.tokenType !== 'refresh') {
        this.logger.warn(
          'Tentativa de usar token que não é de refresh',
          'TokenService',
        );
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.debug(
        `Refresh token inválido: ${error.message}`,
        'TokenService',
      );
      return null;
    }
  }

  extractTokenFromAuthHeader(authHeader: string): string | null {
    if (!authHeader) return null;
    
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private parseExpirationToSeconds(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900; // 15 minutos por padrão
    }
  }
}