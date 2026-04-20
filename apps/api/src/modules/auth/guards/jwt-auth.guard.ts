import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { User } from '@prisma/client';
import { LoggerService } from '../../../common/logger/logger.service';
import { SessionService } from '../services/session.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private logger: LoggerService,
    private sessionService: SessionService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Verifica se a rota é pública
      const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);

      if (isPublic) {
        return true;
      }

      // Autentica usando JWT
      const canActivate = await super.canActivate(context);
      if (!canActivate) {
        return false;
      }

      const request = context.switchToHttp().getRequest<Request>();
      const user = request.user as User;

      // Verifica se a sessão ainda é válida
      const token = this.extractTokenFromHeader(request);
      if (token) {
        const isValidSession = await this.sessionService.isValidSession(
          user.id,
          token,
        );
        
        if (!isValidSession) {
          this.logger.warn(
            `Sessão inválida para usuário ${user.email}`,
            'JwtAuthGuard',
          );
          throw new UnauthorizedException('Sessão expirada ou inválida');
        }
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Erro na autenticação JWT: ${error.message}`,
        'JwtAuthGuard',
      );
      
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const errorMessage = info?.message || err?.message || 'Token inválido';
      this.logger.warn(
        `Falha na autenticação JWT: ${errorMessage}`,
        'JwtAuthGuard',
      );
      throw err || new UnauthorizedException(errorMessage);
    }
    return user;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}