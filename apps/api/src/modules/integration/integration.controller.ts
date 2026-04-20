import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IntegrationService } from './integration.service';
import { JwtAuthGuard } from '../auth/guards';
import { Public } from '../auth/decorators';

@ApiTags('Integração & Dashboard')
@Controller('integration')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obter estatísticas do dashboard',
    description: 'Retorna métricas atualizadas para exibição no dashboard administrativo'
  })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas do dashboard obtidas com sucesso',
    schema: {
      type: 'object',
      properties: {
        totalDocuments: { type: 'number', example: 1234 },
        pendingDocuments: { type: 'number', example: 56 },
        completedDocuments: { type: 'number', example: 1178 },
        totalUsers: { type: 'number', example: 20 },
        activeUsers: { type: 'number', example: 15 },
        todayUploads: { type: 'number', example: 23 },
        storageUsed: { type: 'string', example: '2.4 GB' },
        systemHealth: {
          type: 'object',
          properties: {
            api: { type: 'string', example: 'online' },
            database: { type: 'string', example: 'connected' },
            processing: { type: 'string', example: 'active' },
            storage: { type: 'number', example: 65 }
          }
        }
      }
    }
  })
  async getDashboardStats() {
    return this.integrationService.getDashboardStats();
  }

  @Get('dashboard/activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obter atividades recentes',
    description: 'Retorna lista de atividades recentes do sistema'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número máximo de atividades a retornar (padrão: 10)'
  })
  async getRecentActivities(@Query('limit') limit?: string) {
    const numLimit = limit ? parseInt(limit, 10) : 10;
    return this.integrationService.getRecentActivities(numLimit);
  }

  @Get('health')
  @Public()
  @ApiOperation({ 
    summary: 'Health check do sistema',
    description: 'Verifica a saúde geral do sistema e serviços'
  })
  @ApiResponse({
    status: 200,
    description: 'Status de saúde do sistema',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-04-18T22:30:00.000Z' },
        uptime: { type: 'number', example: 3600 },
        services: {
          type: 'object',
          properties: {
            api: { type: 'boolean' },
            database: { type: 'boolean' },
            storage: { type: 'boolean' },
            processing: { type: 'boolean' }
          }
        }
      }
    }
  })
  async checkHealth() {
    return this.integrationService.checkSystemHealth();
  }

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Configurações da aplicação',
    description: 'Retorna configurações necessárias para o funcionamento do frontend'
  })
  async getAppConfig() {
    return this.integrationService.getAppConfig();
  }
}
