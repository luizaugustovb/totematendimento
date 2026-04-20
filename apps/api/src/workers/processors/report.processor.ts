import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { REPORT_QUEUE, REPORT_JOBS } from '../../core/constants/queues';
import { LoggerService } from '../../core/logger/logger.service';
import { PrismaService } from '../../core/database/prisma.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs/promises';
import * as path from 'path';

@Processor(REPORT_QUEUE, {
  concurrency: 2,
  stalledInterval: 45 * 1000,
  maxStalledCount: 1,
})
@Injectable()
export class ReportProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing report job: ${job.name}`, { 
        jobId: job.id, 
        data: job.data 
      });

      let result: any;

      switch (job.name) {
        case REPORT_JOBS.GENERATE_PATIENT_REPORT:
          result = await this.generatePatientReport(job);
          break;
        
        case REPORT_JOBS.GENERATE_STATISTICS_REPORT:
          result = await this.generateStatisticsReport(job);
          break;
        
        case REPORT_JOBS.GENERATE_USAGE_REPORT:
          result = await this.generateUsageReport(job);
          break;
        
        case REPORT_JOBS.GENERATE_ERROR_REPORT:
          result = await this.generateErrorReport(job);
          break;
        
        case REPORT_JOBS.EXPORT_TO_PDF:
          result = await this.exportToPdf(job);
          break;
        
        case REPORT_JOBS.EXPORT_TO_EXCEL:
          result = await this.exportToExcel(job);
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      
      this.logger.info(`Report job completed: ${job.name}`, {
        jobId: job.id,
        duration,
        success: true,
      });

      await this.saveJobHistory(job, result, duration, true);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Report job failed: ${job.name}`, error, {
        jobId: job.id,
        data: job.data,
        duration,
      });

      await this.saveJobHistory(job, null, duration, false, error);

      throw error;
    }
  }

  // ============================================================================
  // PROCESSADORES ESPECÍFICOS
  // ============================================================================

  private async generatePatientReport(job: Job): Promise<any> {
    const { pacienteId, opcoes = {} } = job.data;
    
    if (!pacienteId) {
      throw new Error('ID do paciente é obrigatório');
    }

    await job.updateProgress(20);

    // Buscar dados do paciente
    const paciente = await this.prisma.user.findUnique({
      where: { id: pacienteId },
      include: {
        documentos: {
          where: { status: 'PROCESSADO' },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            documentos: true,
          }
        }
      }
    });

    if (!paciente) {
      throw new Error(`Paciente não encontrado: ${pacienteId}`);
    }

    await job.updateProgress(50);

    // Gerar estatísticas
    const estatisticas = await this.generatePatientStatistics(pacienteId);
    
    await job.updateProgress(70);

    // Montar relatório
    const relatorio = {
      paciente: {
        id: paciente.id,
        nome: paciente.name,
        email: paciente.email,
        createdAt: paciente.createdAt,
      },
      estatisticas,
      documentos: paciente.documentos.map(doc => ({
        id: doc.id,
        nome: doc.nome,
        tipo: doc.tipoMime,
        tamanho: doc.tamanho,
        processedAt: doc.processedAt,
      })),
      resumo: {
        totalDocumentos: paciente._count.documentos,
        ultimoAcesso: paciente.updatedAt,
      },
      geradoEm: new Date(),
    };

    await job.updateProgress(90);

    // Salvar relatório
    const relatorioSalvo = await this.prisma.relatorio.create({
      data: {
        tipo: 'PACIENTE',
        titulo: `Relatório do Paciente - ${paciente.name}`,
        conteudo: JSON.stringify(relatorio),
        usuarioId: pacienteId,
        status: 'GERADO',
      }
    });

    await job.updateProgress(100);

    return { relatorioId: relatorioSalvo.id, relatorio };
  }

  private async generateStatisticsReport(job: Job): Promise<any> {
    const { filtros = {} } = job.data;

    await job.updateProgress(20);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Estatísticas de usuários
    const usuariosStats = await this.prisma.user.groupBy({
      by: ['createdAt'],
      _count: { id: true },
      where: {
        createdAt: {
          gte: filtros.dataInicio || thirtyDaysAgo,
          lte: filtros.dataFim || now,
        }
      }
    });

    await job.updateProgress(40);

    // Estatísticas de documentos
    const documentosStats = await this.prisma.documento.groupBy({
      by: ['status', 'tipoMime'],
      _count: { id: true },
      _avg: { tamanho: true },
      where: {
        createdAt: {
          gte: filtros.dataInicio || thirtyDaysAgo,
          lte: filtros.dataFim || now,
        }
      }
    });

    await job.updateProgress(60);

    // Estatísticas de processamento IA
    const iaStats = await this.prisma.jobHistory.groupBy({
      by: ['success', 'jobName'],
      _count: { id: true },
      _avg: { duration: true },
      where: {
        queueName: 'ia-processing',
        processedAt: {
          gte: filtros.dataInicio || thirtyDaysAgo,
          lte: filtros.dataFim || now,
        }
      }
    });

    await job.updateProgress(80);

    // Montar relatório
    const relatorio = {
      periodo: {
        inicio: filtros.dataInicio || thirtyDaysAgo,
        fim: filtros.dataFim || now,
      },
      usuarios: {
        novosUsuarios: usuariosStats.length,
        distribuicaoPorData: usuariosStats,
      },
      documentos: {
        totalProcessados: documentosStats.reduce((acc, stat) => acc + stat._count.id, 0),
        porStatus: documentosStats,
        tamanhoMedio: documentosStats.reduce((acc, stat) => acc + (stat._avg.tamanho || 0), 0) / documentosStats.length,
      },
      ia: {
        jobsExecutados: iaStats.reduce((acc, stat) => acc + stat._count.id, 0),
        tempoMedioProcessamento: iaStats.reduce((acc, stat) => acc + (stat._avg.duration || 0), 0) / (iaStats.length || 1),
        taxaSucesso: iaStats.filter(stat => stat.success).reduce((acc, stat) => acc + stat._count.id, 0) / 
                     iaStats.reduce((acc, stat) => acc + stat._count.id, 0),
        porTipo: iaStats,
      },
      geradoEm: new Date(),
    };

    await job.updateProgress(95);

    // Salvar relatório
    const relatorioSalvo = await this.prisma.relatorio.create({
      data: {
        tipo: 'ESTATISTICAS',
        titulo: 'Relatório de Estatísticas do Sistema',
        conteudo: JSON.stringify(relatorio),
        status: 'GERADO',
      }
    });

    await job.updateProgress(100);

    return { relatorioId: relatorioSalvo.id, relatorio };
  }

  private async generateUsageReport(job: Job): Promise<any> {
    const { filtros = {} } = job.data;

    await job.updateProgress(25);

    // Logs de uso do sistema
    const logsUso = await this.prisma.log.findMany({
      where: {
        level: 'INFO',
        createdAt: {
          gte: filtros.dataInicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lte: filtros.dataFim || new Date(),
        }
      },
      take: 1000,
      orderBy: { createdAt: 'desc' }
    });

    await job.updateProgress(50);

    // Análise de uso por endpoint
    const endpointsUso = logsUso
      .filter(log => log.message.includes('Request:'))
      .reduce((acc, log) => {
        const endpoint = this.extractEndpointFromLog(log.message);
        acc[endpoint] = (acc[endpoint] || 0) + 1;
        return acc;
      }, {});

    await job.updateProgress(75);

    const relatorio = {
      periodo: {
        inicio: filtros.dataInicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        fim: filtros.dataFim || new Date(),
      },
      totalRequests: Object.values(endpointsUso).reduce((acc: number, count) => acc + (count as number), 0),
      endpointsMaisUsados: Object.entries(endpointsUso)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10),
      usuariosAtivos: await this.prisma.user.count({
        where: {
          updatedAt: {
            gte: filtros.dataInicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          }
        }
      }),
      geradoEm: new Date(),
    };

    // Salvar relatório
    const relatorioSalvo = await this.prisma.relatorio.create({
      data: {
        tipo: 'USO',
        titulo: 'Relatório de Uso do Sistema',
        conteudo: JSON.stringify(relatorio),
        status: 'GERADO',
      }
    });

    await job.updateProgress(100);

    return { relatorioId: relatorioSalvo.id, relatorio };
  }

  private async generateErrorReport(job: Job): Promise<any> {
    const { filtros = {} } = job.data;

    await job.updateProgress(30);

    // Buscar logs de erro
    const logsErro = await this.prisma.log.findMany({
      where: {
        level: 'ERROR',
        createdAt: {
          gte: filtros.dataInicio || new Date(Date.now() - 24 * 60 * 60 * 1000),
          lte: filtros.dataFim || new Date(),
        }
      },
      take: 500,
      orderBy: { createdAt: 'desc' }
    });

    await job.updateProgress(60);

    // Buscar jobs falhados
    const jobsFalhados = await this.prisma.jobHistory.findMany({
      where: {
        success: false,
        processedAt: {
          gte: filtros.dataInicio || new Date(Date.now() - 24 * 60 * 60 * 1000),
          lte: filtros.dataFim || new Date(),
        }
      },
      take: 200,
      orderBy: { processedAt: 'desc' }
    });

    await job.updateProgress(80);

    // Análise de erros
    const errosPorTipo = logsErro.reduce((acc, log) => {
      const tipoErro = this.extractErrorType(log.message);
      acc[tipoErro] = (acc[tipoErro] || 0) + 1;
      return acc;
    }, {});

    const relatorio = {
      periodo: {
        inicio: filtros.dataInicio || new Date(Date.now() - 24 * 60 * 60 * 1000),
        fim: filtros.dataFim || new Date(),
      },
      resumo: {
        totalErros: logsErro.length,
        totalJobsFalhados: jobsFalhados.length,
        errorRate: logsErro.length / 100, // Assumindo 100 como base
      },
      errosPorTipo,
      jobsFalhadosRecentes: jobsFalhados.slice(0, 20).map(job => ({
        jobName: job.jobName,
        error: job.error,
        processedAt: job.processedAt,
        queueName: job.queueName,
      })),
      logsErroRecentes: logsErro.slice(0, 20).map(log => ({
        message: log.message,
        context: log.context,
        createdAt: log.createdAt,
      })),
      geradoEm: new Date(),
    };

    // Salvar relatório
    const relatorioSalvo = await this.prisma.relatorio.create({
      data: {
        tipo: 'ERRO',
        titulo: 'Relatório de Erros do Sistema',
        conteudo: JSON.stringify(relatorio),
        status: 'GERADO',
      }
    });

    await job.updateProgress(100);

    return { relatorioId: relatorioSalvo.id, relatorio };
  }

  private async exportToPdf(job: Job): Promise<any> {
    const { relatorioId, opcoes = {} } = job.data;

    const relatorio = await this.prisma.relatorio.findUnique({
      where: { id: relatorioId }
    });

    if (!relatorio) {
      throw new Error(`Relatório não encontrado: ${relatorioId}`);
    }

    await job.updateProgress(40);

    // Gerar PDF
    const reportsDir = path.join(process.cwd(), 'storage', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const pdfPath = path.join(reportsDir, `${relatorio.id}.pdf`);
    const conteudo = JSON.parse(relatorio.conteudo);

    const doc = new PDFDocument();
    doc.pipe(require('fs').createWriteStream(pdfPath));

    // Cabeçalho
    doc.fontSize(18).text(relatorio.titulo, 50, 50);
    doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString()}`, 50, 80);

    await job.updateProgress(70);

    // Conteúdo (simplificado)
    let yPosition = 120;
    const addTextLine = (text: string) => {
      doc.text(text, 50, yPosition);
      yPosition += 20;
    };

    addTextLine('RESUMO EXECUTIVO');
    addTextLine('-'.repeat(50));

    // Adicionar conteúdo baseado no tipo
    if (relatorio.tipo === 'ESTATISTICAS') {
      addTextLine(`Total de usuários: ${conteudo.usuarios?.novosUsuarios || 0}`);
      addTextLine(`Total de documentos: ${conteudo.documentos?.totalProcessados || 0}`);
      addTextLine(`Taxa de sucesso IA: ${((conteudo.ia?.taxaSucesso || 0) * 100).toFixed(2)}%`);
    }

    doc.end();

    await job.updateProgress(90);

    // Atualizar relatório
    await this.prisma.relatorio.update({
      where: { id: relatorioId },
      data: {
        pdfPath,
        status: 'EXPORTADO_PDF',
      }
    });

    await job.updateProgress(100);

    return { relatorioId, pdfPath };
  }

  private async exportToExcel(job: Job): Promise<any> {
    const { relatorioId, opcoes = {} } = job.data;

    const relatorio = await this.prisma.relatorio.findUnique({
      where: { id: relatorioId }
    });

    if (!relatorio) {
      throw new Error(`Relatório não encontrado: ${relatorioId}`);
    }

    await job.updateProgress(40);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório');

    const conteudo = JSON.parse(relatorio.conteudo);

    // Cabeçalho
    worksheet.addRow([relatorio.titulo]);
    worksheet.addRow([`Gerado em: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]);

    await job.updateProgress(70);

    // Dados específicos por tipo
    if (relatorio.tipo === 'ESTATISTICAS') {
      worksheet.addRow(['ESTATÍSTICAS GERAIS']);
      worksheet.addRow(['Métrica', 'Valor']);
      worksheet.addRow(['Novos Usuários', conteudo.usuarios?.novosUsuarios || 0]);
      worksheet.addRow(['Total Documentos', conteudo.documentos?.totalProcessados || 0]);
      worksheet.addRow(['Taxa Sucesso IA', ((conteudo.ia?.taxaSucesso || 0) * 100).toFixed(2) + '%']);
    }

    // Salvar arquivo
    const reportsDir = path.join(process.cwd(), 'storage', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const excelPath = path.join(reportsDir, `${relatorio.id}.xlsx`);
    await workbook.xlsx.writeFile(excelPath);

    await job.updateProgress(90);

    // Atualizar relatório
    await this.prisma.relatorio.update({
      where: { id: relatorioId },
      data: {
        excelPath,
        status: 'EXPORTADO_EXCEL',
      }
    });

    await job.updateProgress(100);

    return { relatorioId, excelPath };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async generatePatientStatistics(pacienteId: string) {
    const documentosCount = await this.prisma.documento.count({
      where: { usuarioId: pacienteId }
    });

    const documentosPorStatus = await this.prisma.documento.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { usuarioId: pacienteId }
    });

    const ultimoProcessamento = await this.prisma.documento.findFirst({
      where: { usuarioId: pacienteId, status: 'PROCESSADO' },
      orderBy: { processedAt: 'desc' },
      select: { processedAt: true }
    });

    return {
      totalDocumentos: documentosCount,
      documentosPorStatus,
      ultimoProcessamento: ultimoProcessamento?.processedAt,
    };
  }

  private extractEndpointFromLog(message: string): string {
    const match = message.match(/Request: (\w+) (\/[^\s]*)/);
    return match ? `${match[1]} ${match[2]}` : 'Unknown';
  }

  private extractErrorType(message: string): string {
    if (message.includes('ValidationError')) return 'Validation';
    if (message.includes('DatabaseError')) return 'Database';
    if (message.includes('AuthError')) return 'Authentication';
    if (message.includes('NetworkError')) return 'Network';
    return 'General';
  }

  private async saveJobHistory(
    job: Job, 
    result: any, 
    duration: number, 
    success: boolean, 
    error?: Error
  ): Promise<void> {
    try {
      await this.prisma.jobHistory.create({
        data: {
          jobId: String(job.id),
          queueName: REPORT_QUEUE,
          jobName: job.name,
          jobData: JSON.stringify(job.data),
          result: result ? JSON.stringify(result) : null,
          error: error ? error.message : null,
          duration,
          success,
          processedAt: new Date(),
        }
      });
    } catch (err) {
      this.logger.error('Failed to save job history', err, {
        jobId: job.id,
        jobName: job.name,
      });
    }
  }

  // Event handlers
  async onCompleted(job: Job, result: any) {
    this.logger.info(`Report job completed: ${job.name}`, {
      jobId: job.id,
      result: typeof result === 'object' ? Object.keys(result) : result
    });
  }

  async onFailed(job: Job, error: Error) {
    this.logger.error(`Report job failed: ${job.name}`, error, {
      jobId: job.id,
      attempts: job.attemptsMade,
      data: job.data
    });
  }
}