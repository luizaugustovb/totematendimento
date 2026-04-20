import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor(private logger: LoggerService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      
      if (!result) {
        this.logger.warn('Falha na autenticação local', 'LocalAuthGuard');
        return false;
      }

      const request = context.switchToHttp().getRequest();
      const user = request.user;

      if (user && user.email) {
        this.logger.info(
          `Login bem-sucedido para usuário: ${user.email}`,
          'LocalAuthGuard',
        );
      }

      return !!result;
    } catch (error) {
      this.logger.error(
        `Erro na autenticação local: ${error.message}`,
        'LocalAuthGuard',
      );
      throw error;
    }
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const errorMessage = info?.message || err?.message || 'Credenciais inválidas';
      this.logger.warn(
        `Falha na autenticação local: ${errorMessage}`,
        'LocalAuthGuard',
      );
      throw err || new UnauthorizedException(errorMessage);
    }
    return user;
  }
}