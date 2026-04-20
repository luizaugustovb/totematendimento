import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/database/prisma.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  tokenType?: 'access' | 'refresh';
  sessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<User | null> {
    try {
      this.logger.debug(
        `Validando JWT payload: ${JSON.stringify({ sub: payload.sub, email: payload.email })}`,
        'JwtStrategy',
      );

      if (!payload.sub || !payload.email) {
        this.logger.warn('Payload JWT inválido: faltam campos obrigatórios', 'JwtStrategy');
        throw new UnauthorizedException('Token inválido');
      }

      // Busca o usuário no banco de dados
      const user = await this.prisma.user.findUnique({
        where: { 
          id: payload.sub,
          ativo: true, // Apenas usuários ativos
        },
      });

      if (!user) {
        this.logger.warn(
          `Usuário não encontrado ou inativo: ${payload.sub}`,
          'JwtStrategy',
        );
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      if (user.email !== payload.email) {
        this.logger.warn(
          `Email no token (${payload.email}) não corresponde ao usuário (${user.email})`,
          'JwtStrategy',
        );
        throw new UnauthorizedException('Token inválido');
      }

      // Remove informações sensíveis do retorno
      const { password, ...safeUser } = user;

      this.logger.debug(
        `Autenticação JWT bem-sucedida para usuário: ${user.email}`,
        'JwtStrategy',
      );

      return safeUser as User;
    } catch (error) {
      this.logger.error(
        `Erro na validação JWT: ${error.message}`,
        'JwtStrategy',
      );
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Erro na validação do token');
    }
  }
}