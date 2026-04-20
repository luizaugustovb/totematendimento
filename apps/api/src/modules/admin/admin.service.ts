import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getDashboardData() {
    try {
      const [
        totalUsers,
        totalDocuments,
        recentActivities,
        systemErrors
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.documento.count(),
        this.getRecentActivities(),
        this.getRecentErrors()
      ]);

      return {
        overview: {
          totalUsers,
          totalDocuments,
          activeToday: await this.getActiveUsersToday(),
          documentsToday: await this.getDocumentsProcessedToday(),
        },
        recentActivities,
        systemErrors,
        lastUpdated: new Date(),
      };

    } catch (error) {
      this.logger.error('Failed to get dashboard data', error);
      throw error;
    }
  }

  async getSystemStats() {
    try {
      const stats = {
        database: await this.getDatabaseStats(),
        queues: await this.getQueueStats(),
        performance: await this.getPerformanceStats(),
        errors: await this.getErrorStats(),
      };

      return stats;

    } catch (error) {
      this.logger.error('Failed to get system stats', error);
      throw error;
    }
  }

  async getHealthStatus() {
    try {
      const health = {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        queues: await this.checkQueuesHealth(),
        storage: await this.checkStorageHealth(),
        overall: 'healthy',
        timestamp: new Date(),
      };

      // Determine overall health
      const healthStatuses = Object.values(health).filter(v => typeof v === 'string' && v !== 'healthy');
      if (healthStatuses.length > 0) {
        health.overall = 'degraded';
      }

      return health;

    } catch (error) {
      this.logger.error('Failed to check health status', error);
      return {
        overall: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  private async getActiveUsersToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.prisma.user.count({
      where: {
        updatedAt: {
          gte: today,
        },
      },
    });
  }

  private async getDocumentsProcessedToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.prisma.documento.count({
      where: {
        processedAt: {
          gte: today,
        },
      },
    });
  }

  private async getRecentActivities() {
    const activities = await this.prisma.log.findMany({
      where: {
        level: 'INFO',
        message: {
          contains: 'Request:',
        },
      },
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return activities.map(activity => ({
      id: activity.id,
      type: 'request',
      message: this.extractActivityMessage(activity.message),
      timestamp: activity.createdAt,
    }));
  }

  private async getRecentErrors() {
    const errors = await this.prisma.log.findMany({
      where: {
        level: 'ERROR',
      },
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return errors.map(error => ({
      id: error.id,
      message: error.message,
      timestamp: error.createdAt,
      context: error.context,
    }));
  }

  private async getDatabaseStats() {
    const tables = [
      { name: 'users', count: await this.prisma.user.count() },
      { name: 'documents', count: await this.prisma.documento.count() },
      { name: 'logs', count: await this.prisma.log.count() },
    ];

    return {
      tables,
      totalRecords: tables.reduce((sum, table) => sum + table.count, 0),
    };
  }

  private async getQueueStats() {
    try {
      const jobStats = await this.prisma.jobHistory.groupBy({
        by: ['queueName', 'success'],
        _count: {
          id: true,
        },
        where: {
          processedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      return {
        totalJobs: jobStats.reduce((sum, stat) => sum + stat._count.id, 0),
        successful: jobStats
          .filter(stat => stat.success)
          .reduce((sum, stat) => sum + stat._count.id, 0),
        failed: jobStats
          .filter(stat => !stat.success)
          .reduce((sum, stat) => sum + stat._count.id, 0),
        byQueue: jobStats,
      };

    } catch (error) {
      this.logger.warn('Failed to get queue stats', error);
      return { error: 'Queue stats unavailable' };
    }
  }

  private async getPerformanceStats() {
    try {
      const avgDuration = await this.prisma.jobHistory.aggregate({
        _avg: {
          duration: true,
        },
        where: {
          success: true,
          processedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      return {
        averageJobDuration: avgDuration._avg.duration || 0,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };

    } catch (error) {
      return {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };
    }
  }

  private async getErrorStats() {
    const recentErrors = await this.prisma.log.count({
      where: {
        level: 'ERROR',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    const criticalErrors = await this.prisma.log.count({
      where: {
        level: 'ERROR',
        message: {
          contains: 'CRITICAL',
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      last24Hours: recentErrors,
      critical: criticalErrors,
    };
  }

  private async checkDatabaseHealth(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  private async checkRedisHealth(): Promise<string> {
    try {
      // This would need to be implemented with actual Redis connection
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  private async checkQueuesHealth(): Promise<string> {
    try {
      // Check if there are too many failed jobs
      const failedJobs = await this.prisma.jobHistory.count({
        where: {
          success: false,
          processedAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      return failedJobs > 10 ? 'degraded' : 'healthy';

    } catch (error) {
      return 'unhealthy';
    }
  }

  private async checkStorageHealth(): Promise<string> {
    try {
      // Basic check - this could be expanded to check disk space, etc.
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  private extractActivityMessage(logMessage: string): string {
    const match = logMessage.match(/Request: (\w+) (\/[^\s]*)/);
    return match ? `${match[1]} ${match[2]}` : logMessage;
  }
}