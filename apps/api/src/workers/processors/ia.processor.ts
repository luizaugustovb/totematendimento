import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { IA_QUEUE, IA_JOBS, JOB_TIMEOUTS } from '../../core/constants/queues';
import { IaService } from '../../modules/ia/ia.service';
import { LoggerService } from '../../core/logger/logger.service';
import { PrismaService } from '../../core/database/prisma.service';

@Processor(IA_QUEUE, {
  concurrency: 5,
  stalledInterval: 30 * 1000,
  maxStalledCount: 1,
})
@Injectable()
export class IaProcessor extends WorkerHost {
  constructor(
    private readonly iaService: IaService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing IA job: ${job.name}`, { 
        jobId: job.id, 
        data: job.data 
      });

      let result: any;

      switch (job.name) {
        case IA_JOBS.PROCESS_TEXT:
          result = await this.processText(job);
          break;
        
        case IA_JOBS.NORMALIZE_EXAM:
          result = await this.normalizeExam(job);
          break;
        
        case IA_JOBS.INTERPRET_DOCUMENT:
          result = await this.interpretDocument(job);
          break;
        
        case IA_JOBS.EXTRACT_DATA:
          result = await this.extractData(job);
          break;
        
        case IA_JOBS.CLASSIFY_DOCUMENT:
          result = await this.classifyDocument(job);
          break;
        
        case IA_JOBS.VALIDATE_CONSISTENCY:
          result = await this.validateConsistency(job);
          break;
        
        case IA_JOBS.GENERATE_SUMMARY:
          result = await this.generateSummary(job);
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      
      this.logger.info(`IA job completed: ${job.name}`, {
        jobId: job.id,
        duration,
        success: true,
      });

      // Salvar histórico do processamento
      await this.saveJobHistory(job, result, duration, true);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`IA job failed: ${job.name}`, error, {
        jobId: job.id,
        data: job.data,
        duration,
      });

      // Salvar histórico do erro
      await this.saveJobHistory(job, null, duration, false, error);

      throw error;
    }
  }

  // ============================================================================
  // PROCESSADORES ESPECÍFICOS
  // ============================================================================

  private async processText(job: Job): Promise<any> {
    const { texto, opcoes = {} } = job.data;
    
    if (!texto || texto.trim().length === 0) {
      throw new Error('Texto não pode estar vazio');
    }

    const result = await this.iaService.processarTexto(texto, opcoes);
    
    // Atualizar progresso
    await job.updateProgress(100);
    
    return result;
  }

  private async normalizeExam(job: Job): Promise<any> {
    const { dadosExame } = job.data;
    
    if (!dadosExame) {
      throw new Error('Dados do exame são obrigatórios');
    }

    await job.updateProgress(20);
    
    const result = await this.iaService.normalizarExames(dadosExame);
    
    await job.updateProgress(100);
    
    return result;
  }

  private async interpretDocument(job: Job): Promise<any> {
    const { documentoId } = job.data;
    
    if (!documentoId) {
      throw new Error('ID do documento é obrigatório');
    }

    // Buscar documento no banco
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId },
      include: { usuario: true }
    });

    if (!documento) {
      throw new Error(`Documento não encontrado: ${documentoId}`);
    }

    await job.updateProgress(30);

    // Interpretar documento usando IA
    const interpretacao = await this.iaService.interpretarDocumento(documento);
    
    await job.updateProgress(70);

    // Salvar resultado da interpretação
    await this.prisma.documento.update({
      where: { id: documentoId },
      data: {
        interpretacao: JSON.stringify(interpretacao),
        status: 'PROCESSADO',
        processedAt: new Date(),
      }
    });

    await job.updateProgress(100);

    return interpretacao;
  }

  private async extractData(job: Job): Promise<any> {
    const { conteudo, tipoExtração } = job.data;
    
    if (!conteudo || !tipoExtração) {
      throw new Error('Conteúdo e tipo de extração são obrigatórios');
    }

    await job.updateProgress(25);

    const result = await this.iaService.extrairDados(conteudo, tipoExtração);
    
    await job.updateProgress(100);

    return result;
  }

  private async classifyDocument(job: Job): Promise<any> {
    const { documentoId } = job.data;
    
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId }
    });

    if (!documento) {
      throw new Error(`Documento não encontrado: ${documentoId}`);
    }

    await job.updateProgress(40);

    const classificacao = await this.iaService.classificarDocumento(documento);
    
    await job.updateProgress(80);

    // Atualizar classificação no banco
    await this.prisma.documento.update({
      where: { id: documentoId },
      data: {
        categoria: classificacao.categoria,
        tags: classificacao.tags,
        confidenciaClassificacao: classificacao.confianca,
      }
    });

    await job.updateProgress(100);

    return classificacao;
  }

  private async validateConsistency(job: Job): Promise<any> {
    const { dados } = job.data;
    
    if (!dados) {
      throw new Error('Dados para validação são obrigatórios');
    }

    await job.updateProgress(50);

    const validacao = await this.iaService.validarConsistencia(dados);
    
    await job.updateProgress(100);

    return validacao;
  }

  private async generateSummary(job: Job): Promise<any> {
    const { conteudo, opcoes = {} } = job.data;
    
    if (!conteudo) {
      throw new Error('Conteúdo para resumir é obrigatório');
    }

    await job.updateProgress(30);

    const resumo = await this.iaService.gerarResumo(conteudo, opcoes);
    
    await job.updateProgress(100);

    return resumo;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

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
          queueName: IA_QUEUE,
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

  // Event handlers para monitoramento
  async onCompleted(job: Job, result: any) {
    this.logger.info(`IA job completed: ${job.name}`, {
      jobId: job.id,
      result: typeof result === 'object' ? Object.keys(result) : result
    });
  }

  async onFailed(job: Job, error: Error) {
    this.logger.error(`IA job failed: ${job.name}`, error, {
      jobId: job.id,
      attempts: job.attemptsMade,
      data: job.data
    });
  }

  async onProgress(job: Job, progress: number | object) {
    this.logger.debug(`IA job progress: ${job.name}`, {
      jobId: job.id,
      progress
    });
  }

  async onStalled(job: Job) {
    this.logger.warn(`IA job stalled: ${job.name}`, {
      jobId: job.id,
      data: job.data
    });
  }
}