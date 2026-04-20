import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

/**
 * Serviço para registrar e consultar logs de auditoria
 */
@Injectable()
export class LogAuditoriaService {
  private readonly logger = new Logger(LogAuditoriaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Registrar uma ação de auditoria
   */
  async registrar(
    acao: string,
    entidade?: string,
    detalhes?: string,
    usuario?: string,
    ip?: string,
    userAgent?: string,
  ) {
    try {
      const log = await this.prisma.logAuditoria.create({
        data: {
          acao,
          entidade,
          detalhes,
          usuario,
          ip,
          userAgent,
        },
      });

      this.logger.log(
        `📝 Log auditoria: ${acao} | ${entidade || 'N/A'} | ${usuario || 'Sistema'}`,
      );

      return log;
    } catch (erro) {
      this.logger.error('Erro ao registrar log de auditoria', erro);
      // Não lançar erro para não quebrar o fluxo principal
      return null;
    }
  }

  /**
   * Buscar logs com filtros
   */
  async buscar(filtros: {
    acao?: string;
    entidade?: string;
    usuario?: string;
    dataInicio?: Date;
    dataFim?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filtros.acao) {
      where.acao = filtros.acao;
    }

    if (filtros.entidade) {
      where.entidade = {
        contains: filtros.entidade,
        mode: 'insensitive',
      };
    }

    if (filtros.usuario) {
      where.usuario = {
        contains: filtros.usuario,
        mode: 'insensitive',
      };
    }

    if (filtros.dataInicio || filtros.dataFim) {
      where.createdAt = {};
      
      if (filtros.dataInicio) {
        where.createdAt.gte = filtros.dataInicio;
      }
      
      if (filtros.dataFim) {
        where.createdAt.lte = filtros.dataFim;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: filtros.limit || 100,
        skip: filtros.offset || 0,
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return {
      logs,
      total,
      limit: filtros.limit || 100,
      offset: filtros.offset || 0,
    };
  }

  /**
   * Buscar logs recentes (últimas 24 horas)
   */
  async buscarRecentes(limit: number = 50) {
    const dataLimite = new Date();
    dataLimite.setHours(dataLimite.getHours() - 24);

    return this.prisma.logAuditoria.findMany({
      where: {
        createdAt: {
          gte: dataLimite,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Estatísticas de uso
   */
  async estatisticas(dias: number = 7) {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);

    const logs = await this.prisma.logAuditoria.findMany({
      where: {
        createdAt: {
          gte: dataLimite,
        },
      },
      select: {
        acao: true,
        usuario: true,
        createdAt: true,
      },
    });

    // Contar ações
    const acoesPorTipo = logs.reduce((acc, log) => {
      acc[log.acao] = (acc[log.acao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Contar por usuário
    const acoesPorUsuario = logs.reduce((acc, log) => {
      const usuario = log.usuario || 'Sistema';
      acc[usuario] = (acc[usuario] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Ações por dia
    const acoesPorDia = logs.reduce((acc, log) => {
      const data = log.createdAt.toISOString().split('T')[0];
      acc[data] = (acc[data] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalLogs: logs.length,
      periodo: dias,
      acoesPorTipo,
      acoesPorUsuario,
      acoesPorDia,
    };
  }

  /**
   * Limpar logs antigos (manutenção)
   */
  async limparAntigos(diasParaManter: number = 90) {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasParaManter);

    const resultado = await this.prisma.logAuditoria.deleteMany({
      where: {
        createdAt: {
          lt: dataLimite,
        },
      },
    });

    this.logger.log(
      `🗑️ Limpeza de logs: ${resultado.count} registros removidos (> ${diasParaManter} dias)`,
    );

    return resultado;
  }
}
