import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/database/prisma.service';

interface SecurityLogData {
  userId?: string;
  email?: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  success: boolean;
  errorMessage?: string;
  additionalData?: Record<string, any>;
}

@Injectable()
export class SecurityLogInterceptor implements NestInterceptor {
  private readonly securityActions = new Set([
    'login',
    'register', 
    'logout',
    'refresh',
    'change-password',
    'forgot-password',
    'reset-password',
    'verify-email',
    'revoke-session',
    'revoke-all-sessions',
  ]);

  constructor(
    private logger: LoggerService,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    
    // Verificar se é uma ação de segurança
    const action = this.extractAction(request);
    if (!action || !this.securityActions.has(action)) {
      return next.handle();
    }

    const startTime = Date.now();
    const logData: SecurityLogData = {
      action,
      endpoint: request.path,
      method: request.method,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      success: false,
    };

    // Extrair dados do usuário se disponível
    const user = (request as any).user;
    if (user) {
      logData.userId = user.id;
      logData.email = user.email;
    }

    // Extrair email do corpo da requisição para login/registro
    if (['login', 'register', 'forgot-password'].includes(action)) {
      const email = request.body?.email;
      if (email && !logData.email) {
        logData.email = email;
      }
    }

    return next.handle().pipe(
      tap((data) => {
        // Log de sucesso
        const duration = Date.now() - startTime;
        logData.success = true;
        logData.additionalData = {
          duration,
          responseSize: response.get('content-length') || 0,
        };

        // Capturar ID do usuário da resposta se não estava disponível
        if (!logData.userId && data?.user?.id) {
          logData.userId = data.user.id;
          logData.email = data.user.email;
        }

        this.logSecurityEvent(logData);
      }),
      catchError((error) => {
        // Log de erro
        const duration = Date.now() - startTime;
        logData.success = false;
        logData.errorMessage = error.message;
        logData.additionalData = {
          duration,
          errorType: error.constructor.name,
          statusCode: error.status || 500,
        };

        this.logSecurityEvent(logData);
        throw error;
      }),
    );
  }

  private extractAction(request: Request): string | null {
    const path = request.path.toLowerCase();
    const segments = path.split('/').filter(Boolean);
    
    // Assumindo que a estrutura é /auth/{action}
    if (segments.length >= 2 && segments[0] === 'auth') {
      return segments[1];
    }
    
    return null;
  }

  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  private async logSecurityEvent(logData: SecurityLogData): Promise<void> {
    try {
      // Log estruturado para análise
      this.logger.info(
        `Security Event: ${logData.action} - ${logData.success ? 'SUCCESS' : 'FAILED'}`,
        'SecurityAudit',
        {
          ...logData,
          timestamp: new Date().toISOString(),
        },
      );

      // Armazenar no banco de dados para auditoria
      await this.createSecurityAuditLog(logData);

      // Log detalhado para eventos críticos
      if (this.isCriticalEvent(logData)) {
        this.logger.warn(
          `Critical Security Event: ${logData.action} from ${logData.ipAddress} for ${logData.email || 'unknown user'}`,
          'CriticalSecurity',
          logData,
        );
      }

    } catch (error) {
      this.logger.error(
        `Erro ao registrar evento de segurança: ${error.message}`,
        'SecurityAudit',
      );
    }
  }

  private async createSecurityAuditLog(logData: SecurityLogData): Promise<void> {
    try {
      // Implementação futura: salvar no banco para auditoria
      // await this.prisma.securityAuditLog.create({
      //   data: {
      //     userId: logData.userId,
      //     action: logData.action,
      //     ipAddress: logData.ipAddress,
      //     userAgent: logData.userAgent,
      //     endpoint: logData.endpoint,
      //     method: logData.method,
      //     success: logData.success,
      //     errorMessage: logData.errorMessage,
      //     additionalData: logData.additionalData,
      //     createdAt: new Date(),
      //   },
      // });
    } catch (error) {
      this.logger.error(
        `Erro ao salvar log de auditoria: ${error.message}`,
        'SecurityAudit',
      );
    }
  }

  private isCriticalEvent(logData: SecurityLogData): boolean {
    // Eventos críticos que merecem atenção especial
    const criticalActions = [
      'login',
      'change-password',
      'reset-password',
      'revoke-all-sessions',
    ];

    return (
      criticalActions.includes(logData.action) ||
      !logData.success ||
      (logData.additionalData?.statusCode >= 400)
    );
  }
}