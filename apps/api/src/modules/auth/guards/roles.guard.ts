import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@prisma/client';
import { LoggerService } from '../../../common/logger/logger.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private logger: LoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      this.logger.warn(
        'Tentativa de acesso sem usuário autenticado',
        'RolesGuard',
      );
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Para implementação básica, vamos usar um campo 'role' no usuário
    // Em caso de implementação mais complexa, buscar roles do banco
    const userRole = (user as any).role || 'user';
    const hasRole = requiredRoles.includes(userRole);

    if (!hasRole) {
      this.logger.warn(
        `Usuário ${user.email} tentou acessar recurso que requer roles: ${requiredRoles.join(', ')}, mas possui role: ${userRole}`,
        'RolesGuard',
      );
      throw new ForbiddenException(
        `Acesso negado. Requer uma das seguintes permissões: ${requiredRoles.join(', ')}`,
      );
    }

    this.logger.debug(
      `Autorização concedida para usuário ${user.email} com role ${userRole}`,
      'RolesGuard',
    );

    return true;
  }
}