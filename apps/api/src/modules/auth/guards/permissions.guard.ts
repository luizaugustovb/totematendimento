import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@prisma/client';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/database/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private logger: LoggerService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      this.logger.warn(
        'Tentativa de acesso sem usuário autenticado',
        'PermissionsGuard',
      );
      throw new ForbiddenException('Usuário não autenticado');
    }

    try {
      // Busca permissões do usuário (diretas e através de roles)
      const userPermissions = await this.getUserPermissions(user.id);
      
      // Verifica se o usuário possui pelo menos uma das permissões necessárias
      const hasPermission = requiredPermissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        this.logger.warn(
          `Usuário ${user.email} tentou acessar recurso que requer permissões: ${requiredPermissions.join(', ')}, mas possui: ${userPermissions.join(', ')}`,
          'PermissionsGuard',
        );
        throw new ForbiddenException(
          `Acesso negado. Requer uma das seguintes permissões: ${requiredPermissions.join(', ')}`,
        );
      }

      this.logger.debug(
        `Autorização concedida para usuário ${user.email}`,
        'PermissionsGuard',
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Erro ao verificar permissões para usuário ${user.email}: ${error.message}`,
        'PermissionsGuard',
      );
      
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      throw new ForbiddenException('Erro ao verificar permissões');
    }
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    // Implementação futura: buscar do banco de dados
    // Por enquanto, retorna permissões básicas
    return ['read', 'write'];
  }
}