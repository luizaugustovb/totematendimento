import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LogEntry {
  modulo: string;
  nivel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  mensagem: string;
  contextoJson?: any;
  stack?: string;
}

@Injectable()
export class LoggerService {
  private readonly logger = new Logger(LoggerService.name);

  constructor(private prisma: PrismaService) {}

  async debug(modulo: string, mensagem: string, contexto?: any): Promise<void> {
    this.logger.debug(`[${modulo}] ${mensagem}`, contexto);
    
    // Salvar no banco apenas se necessário (desenvolvimento)
    if (process.env.SAVE_DEBUG_LOGS === 'true') {
      await this.salvarLog({
        modulo,
        nivel: 'DEBUG',
        mensagem,
        contextoJson: contexto,
      });
    }
  }

  async info(modulo: string, mensagem: string, contexto?: any): Promise<void> {
    this.logger.log(`[${modulo}] ${mensagem}`, contexto);
    
    await this.salvarLog({
      modulo,
      nivel: 'INFO',
      mensagem,
      contextoJson: contexto,
    });
  }

  async warn(modulo: string, mensagem: string, contexto?: any): Promise<void> {
    this.logger.warn(`[${modulo}] ${mensagem}`, contexto);
    
    await this.salvarLog({
      modulo,
      nivel: 'WARN',
      mensagem,
      contextoJson: contexto,
    });
  }

  async error(modulo: string, mensagem: string, error?: any, contexto?: any): Promise<void> {
    this.logger.error(`[${modulo}] ${mensagem}`, error?.stack, contexto);
    
    await this.salvarLog({
      modulo,
      nivel: 'ERROR',
      mensagem,
      contextoJson: { 
        ...contexto, 
        error_message: error?.message,
        error_name: error?.name,
      },
      stack: error?.stack,
    });
  }

  async obterLogs(filtros: {
    modulo?: string;
    nivel?: string;
    dataInicio?: Date;
    dataFim?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: any[]; meta: any }> {
    const { modulo, nivel, dataInicio, dataFim, page = 1, limit = 50 } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (modulo) where.modulo = modulo;
    if (nivel) where.nivel = nivel;
    if (dataInicio && dataFim) {
      where.createdAt = {
        gte: dataInicio,
        lte: dataFim,
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.logSistema.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.logSistema.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async limparLogsAntigos(diasParaManter = 30): Promise<number> {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasParaManter);

    const resultado = await this.prisma.logSistema.deleteMany({
      where: {
        createdAt: {
          lt: dataLimite,
        },
        // Manter sempre logs de ERROR independente da data
        nivel: { not: 'ERROR' },
      },
    });

    this.logger.log(`Removidos ${resultado.count} logs antigos (mais de ${diasParaManter} dias)`);
    return resultado.count;
  }

  async obterEstatisticasLogs(): Promise<any> {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    const [totalLogs, logsHoje, logsOntem, porNivel, porModulo] = await Promise.all([
      this.prisma.logSistema.count(),
      this.prisma.logSistema.count({
        where: { createdAt: { gte: hoje } },
      }),
      this.prisma.logSistema.count({
        where: { 
          createdAt: { 
            gte: ontem,
            lt: hoje,
          } 
        },
      }),
      this.prisma.logSistema.groupBy({
        by: ['nivel'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.logSistema.groupBy({
        by: ['modulo'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10, // Top 10 módulos
      }),
    ]);

    const porNivelObj = porNivel.reduce((acc, item) => {
      acc[item.nivel] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const porModuloObj = porModulo.reduce((acc, item) => {
      acc[item.modulo] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_logs: totalLogs,
      logs_hoje: logsHoje,
      logs_ontem: logsOntem,
      variacao_diaria: logsOntem > 0 ? ((logsHoje - logsOntem) / logsOntem * 100).toFixed(1) + '%' : 'N/A',
      por_nivel: porNivelObj,
      por_modulo: porModuloObj,
      erros_hoje: porNivelObj['ERROR'] || 0,
      warnings_hoje: porNivelObj['WARN'] || 0,
    };
  }

  private async salvarLog(logEntry: LogEntry): Promise<void> {
    try {
      await this.prisma.logSistema.create({
        data: logEntry,
      });
    } catch (error) {
      // Em caso de erro ao salvar log, apenas imprimir no console
      // para não entrar em loop de erro
      console.error('Erro ao salvar log no banco:', error.message);
    }
  }
}