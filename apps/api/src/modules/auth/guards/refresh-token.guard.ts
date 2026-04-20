import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  constructor(private logger: LoggerService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      
      if (!result) {
        this.logger.warn('Falha na validação do refresh token', 'RefreshTokenGuard');
        return false;
      }

      return !!result;
    } catch (error) {
      this.logger.error(
        `Erro na validação do refresh token: ${error.message}`,
        'RefreshTokenGuard',
      );
      throw error;
    }
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const errorMessage = info?.message || err?.message || 'Refresh token inválido';
      this.logger.warn(
        `Falha na validação do refresh token: ${errorMessage}`,
        'RefreshTokenGuard',
      );
      throw err || new UnauthorizedException(errorMessage);
    }
    return user;
  }
}