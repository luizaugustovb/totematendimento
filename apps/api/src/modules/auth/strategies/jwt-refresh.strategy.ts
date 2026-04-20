import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../common/database/prisma.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { User } from '@prisma/client';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private logger: LoggerService,
    private refreshTokenService: RefreshTokenService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User | null> {
    try {
      this.logger.debug(
        `Validando refresh token para usuário: ${payload.email}`,
        'JwtRefreshStrategy',
      );

      if (!payload.sub || !payload.email || payload.tokenType !== 'refresh') {
        this.logger.warn('Payload de refresh token inválido', 'JwtRefreshStrategy');
        throw new UnauthorizedException('Refresh token inválido');
      }

      // Extração do refresh token do body da requisição
      const refreshToken = req.body?.refreshToken;
      if (!refreshToken) {
        this.logger.warn('Refresh token não fornecido', 'JwtRefreshStrategy');
        throw new UnauthorizedException('Refresh token não fornecido');
      }

      // Verifica se o refresh token é válido e ativo
      const isValidRefreshToken = await this.refreshTokenService.validateRefreshToken(
        payload.sub,
        refreshToken,
      );

      if (!isValidRefreshToken) {
        this.logger.warn(
          `Refresh token inválido ou expirado para usuário: ${payload.email}`,
          'JwtRefreshStrategy',
        );
        throw new UnauthorizedException('Refresh token inválido ou expirado');
      }

      // Busca o usuário no banco de dados
      const user = await this.prisma.user.findUnique({
        where: { 
          id: payload.sub,
          ativo: true,
        },
      });

      if (!user) {
        this.logger.warn(
          `Usuário não encontrado ou inativo durante refresh: ${payload.sub}`,
          'JwtRefreshStrategy',
        );
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      if (user.email !== payload.email) {
        this.logger.warn(
          `Email no refresh token não corresponde ao usuário: ${payload.email}`,
          'JwtRefreshStrategy',
        );
        throw new UnauthorizedException('Refresh token inválido');
      }

      // Remove informações sensíveis
      const { password, ...safeUser } = user;

      this.logger.debug(
        `Refresh token válido para usuário: ${user.email}`,
        'JwtRefreshStrategy',
      );

      return safeUser as User;
    } catch (error) {
      this.logger.error(
        `Erro na validação do refresh token: ${error.message}`,
        'JwtRefreshStrategy',
      );
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Erro na validação do refresh token');
    }
  }
}