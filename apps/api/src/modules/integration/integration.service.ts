import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/infra/database/prisma.service';
import { RedisService } from '../../shared/infra/cache/redis.service';
import { integrationConfig } from '../../core/config/integration.config';

export interface DashboardStats {
  totalDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
  totalUsers: number;
  activeUsers: number;
  todayUploads: number;
  storageUsed: string;
  systemHealth: {
    api: 'online' | 'offline';
    database: 'connected' | 'disconnected';
    processing: 'active' | 'inactive';
    storage: number; // percentage
  };
}

export interface RecentActivity {
  id: string;
  type: 'upload' | 'user_created' | 'document_processed' | 'system_event';
  description: string;
  user: string;
  createdAt: string;
  metadata?: any;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.logger.log('Integration Service initialized with database connection');
  }

  /**
   * Retorna estatísticas do dashboard
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [
        totalDocuments,
        pendingDocuments, 
        completedDocuments,
        totalUsers,
        todayDocuments
      ] = await Promise.all([
        this.prisma.documentoCapturado.count(),
        this.prisma.documentoCapturado.count({
          where: { status: 'PENDING' }
        }),
        this.prisma.documentoCapturado.count({
          where: { status: 'COMPLETED' }
        }),
        this.prisma.usuarioAdmin.count({
          where: { ativo: true }
        }),
        this.prisma.documentoCapturado.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        })
      ]);

      // Active users (logged in last 24h)  
      const activeUsers = await this.prisma.usuarioAdmin.count({
        where: {
          ativo: true,
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      // Calculate storage used (approximate)
      const documentsWithSize = await this.prisma.documentoCapturado.aggregate({
        _sum: { tamanhoBytes: true }
      });
      const totalBytes = documentsWithSize._sum.tamanhoBytes || 0;
      const storageUsed = this.formatBytes(totalBytes);

      const stats: DashboardStats = {
        totalDocuments,
        pendingDocuments,
        completedDocuments,
        totalUsers,
        activeUsers,
        todayUploads: todayDocuments,
        storageUsed,
        systemHealth: {
          api: 'online',
          database: 'connected', 
          processing: 'active',
          storage: Math.min((totalBytes / (10 * 1024 * 1024 * 1024)) * 100, 100), // 10GB limit
        }
      };

      this.logger.debug('Dashboard stats generated from database', { stats });
      return stats;
    } catch (error) {
      this.logger.error('Failed to get dashboard stats from database', error);
      
      // Fallback to mock data in case of database error
      return {
        totalDocuments: 0,
        pendingDocuments: 0, 
        completedDocuments: 0,
        totalUsers: 0,
        activeUsers: 0,
        todayUploads: 0,
        storageUsed: '0 MB',
        systemHealth: {
          api: 'online',
          database: 'disconnected',
          processing: 'inactive', 
          storage: 0
        }
      };
    }
  }

  /**
   * Retorna atividades recentes do sistema
   */
  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    try {
      const [recentDocuments, recentUsers, recentLogs] = await Promise.all([
        // Recent document uploads
        this.prisma.documentoCapturado.findMany({
          take: Math.ceil(limit / 3),
          orderBy: { createdAt: 'desc' },
          include: {
            atendimento: {
              include: {
                paciente: { select: { nomeCompleto: true } }
              }
            }
          }
        }),
        
        // Recent user registrations  
        this.prisma.usuarioAdmin.findMany({
          take: Math.ceil(limit / 3),
          orderBy: { createdAt: 'desc' },
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }),

        // Recent system logs
        this.prisma.logSistema.findMany({
          take: Math.ceil(limit / 3),
          orderBy: { createdAt: 'desc' },
          include: {
            usuarioAdmin: { select: { nome: true } }
          }
        })
      ]);

      const activities: RecentActivity[] = [];

      // Process documents
      recentDocuments.forEach(doc => {
        activities.push({
          id: `doc-${doc.id}`,
          type: doc.status === 'COMPLETED' ? 'document_processed' : 'upload',
          description: `${doc.status === 'COMPLETED' ? 'Documento processado' : 'Documento capturado'}: ${doc.tipo}`,
          user: doc.atendimento?.paciente?.nomeCompleto || 'Sistema',
          createdAt: doc.createdAt.toISOString(),
          metadata: {
            fileName: doc.nomeArquivo || 'documento.pdf',
            fileSize: this.formatBytes(doc.tamanhoBytes || 0),
            status: doc.status,
            tipo: doc.tipo
          }
        });
      });

      // Process users
      recentUsers.forEach(user => {
        activities.push({
          id: `user-${user.id}`,
          type: 'user_created',
          description: `Novo usuário criado: ${user.nome}`,
          user: 'Sistema',
          createdAt: user.createdAt.toISOString(),
          metadata: {
            email: user.email,
            role: user.perfil
          }
        });
      });

      // Process logs
      recentLogs.forEach(log => {
        activities.push({
          id: `log-${log.id}`,
          type: 'system_event',
          description: log.erro || log.acao || 'Evento do sistema',
          user: log.usuarioAdmin?.nome || 'Sistema',
          createdAt: log.createdAt.toISOString(),
          metadata: {
            action: log.acao,
            nivel: log.nivel,
            detalhes: log.detalhes
          }
        });
      });

      // Sort by date and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      return sortedActivities;
    } catch (error) {
      this.logger.error('Failed to get recent activities from database', error);
      
      // Return empty array on error
      return [];
    }
  }

  /**
   * Health check do sistema
   */
  async checkSystemHealth(): Promise<any> {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        api: true,
        database: false,
        storage: false,
        processing: false,
      },
      config: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      }
    };

    // Test database connection
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      health.services.database = true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      health.status = 'degraded';
    }

    // Test Redis connection
    try {
      await this.redis.ping();
      health.services.storage = true;
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      health.status = 'degraded';
    }

    // Test file storage
    try {
      const fs = await import('fs/promises');
      await fs.access('./storage');
      health.services.processing = true;
    } catch (error) {
      this.logger.error('Storage health check failed', error);
      health.status = 'degraded';
    }

    this.logger.debug('System health checked', health);
    return health;
  }

  /**
   * Configurações da aplicação para o frontend
   */
  async getAppConfig(): Promise<any> {
    try {
      // Get dynamic config from database
      const configs = await this.prisma.configuracaoSistema.findMany({
        where: { ativo: true }
      });

      const configMap = {};
      configs.forEach(config => {
        configMap[config.chave] = this.parseConfigValue(config.valor, config.tipo);
      });

      return {
        upload: {
          maxFileSize: configMap['maxFileSize'] || integrationConfig.upload.maxFileSize,
          allowedTypes: configMap['allowedTypes'] || integrationConfig.upload.allowedMimeTypes,
        },
        features: {
          iaEnabled: configMap['iaEnabled'] ?? integrationConfig.ia.enabled,
          ocrEnabled: configMap['ocrEnabled'] ?? integrationConfig.external.ocr.enabled,
          realTimeNotifications: configMap['realTimeNotifications'] ?? true,
          multiTenancy: configMap['multiTenancy'] ?? false,
        },
        limits: {
          rateLimit: configMap['rateLimit'] || integrationConfig.rateLimit,
          maxFilesPerUpload: configMap['maxFilesPerUpload'] || 10,
          maxRequestsPerMinute: configMap['maxRequestsPerMinute'] || 100,
        },
        ui: {
          theme: configMap['defaultTheme'] || 'light',
          logo: configMap['appLogo'] || '/images/logo.png',
          title: configMap['appTitle'] || 'Digitalização CACIM',
        }
      };
    } catch (error) {
      this.logger.error('Failed to get app config from database', error);
      
      // Return default config
      return {
        upload: {
          maxFileSize: integrationConfig.upload.maxFileSize,
          allowedTypes: integrationConfig.upload.allowedMimeTypes,
        },
        features: {
          iaEnabled: integrationConfig.ia.enabled,
          ocrEnabled: integrationConfig.external.ocr.enabled,
          realTimeNotifications: true,
          multiTenancy: false,
        },
        limits: {
          rateLimit: integrationConfig.rateLimit,
          maxFilesPerUpload: 10,
          maxRequestsPerMinute: 100,
        },
        ui: {
          theme: 'light',
          logo: '/images/logo.png',
          title: 'Digitalização CACIM',
        }
      };
    }
  }

  /**
   * Log de eventos do sistema
   */
  async logSystemEvent(event: string, details: any): Promise<void> {
    try {
      this.logger.log(`System Event: ${event}`, details);
      
      // Save to database logs
      await this.prisma.logSistema.create({
        data: {
          acao: event,
          erro: typeof details === 'string' ? details : JSON.stringify(details),
          detalhes: typeof details === 'object' ? JSON.stringify(details) : details,
          nivel: 'INFO',
          createdAt: new Date()
        }
      });
    } catch (error) {
      this.logger.error('Failed to log system event', error);
    }
  }

  // Helper methods
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private parseConfigValue(valor: string, tipo: string): any {
    switch (tipo) {
      case 'boolean':
        return valor === 'true' || valor === '1';
      case 'number':
        return parseFloat(valor);
      case 'json':
        try {
          return JSON.parse(valor);
        } catch {
          return valor;
        }
      default:
        return valor;
    }
  }
}
