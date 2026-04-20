import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { LoggerService } from '../core/logger/logger.service';
import { RedisService } from '../core/redis/redis.service';
import { 
  IA_QUEUE, 
  DOCUMENT_QUEUE, 
  REPORT_QUEUE, 
  EMAIL_QUEUE,
  IA_JOBS,
  DOCUMENT_JOBS,
  REPORT_JOBS,
  EMAIL_JOBS,
  JOB_PRIORITIES,
  JOB_TIMEOUTS
} from '../core/constants/queues';

export interface JobStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueHealth {
  name: string;
  isHealthy: boolean;
  stats: JobStats;
  lastProcessed?: Date;
  processorsActive: number;
  errorRate: number;
}

@Injectable()
export class WorkerService implements OnModuleInit {
  constructor(
    @InjectQueue(IA_QUEUE) private iaQueue: Queue,
    @InjectQueue(DOCUMENT_QUEUE) private documentQueue: Queue,
    @InjectQueue(REPORT_QUEUE) private reportQueue: Queue,
    @InjectQueue(EMAIL_QUEUE) private emailQueue: Queue,
    private readonly logger: LoggerService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    try {
      await this.setupQueues();
      await this.setupMonitoring();
      this.logger.info('WorkerService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize WorkerService', error);
    }
  }

  // ============================================================================
  // IA PROCESSING JOBS
  // ============================================================================

  async addIaProcessingJob(type: keyof typeof IA_JOBS, data: any, options = {}) {
    try {
      const job = await this.iaQueue.add(IA_JOBS[type], data, {
        priority: JOB_PRIORITIES.HIGH,
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...options,
      });

      this.logger.info(`IA job added: ${type}`, { jobId: job.id, data });
      return job;
    } catch (error) {
      this.logger.error(`Failed to add IA job: ${type}`, error, { data });
      throw error;
    }
  }

  async processText(texto: string, opcoes = {}) {
    return this.addIaProcessingJob('PROCESS_TEXT', { texto, opcoes });
  }

  async normalizeExam(dadosExame: any) {
    return this.addIaProcessingJob('NORMALIZE_EXAM', { dadosExame });
  }

  async interpretDocument(documentoId: string) {
    return this.addIaProcessingJob('INTERPRET_DOCUMENT', { documentoId }, {
      priority: JOB_PRIORITIES.MEDIUM,
    });
  }

  async extractData(conteudo: string, tipoExtração: string) {
    return this.addIaProcessingJob('EXTRACT_DATA', { conteudo, tipoExtração });
  }

  // ============================================================================
  // DOCUMENT PROCESSING JOBS
  // ============================================================================

  async addDocumentProcessingJob(type: keyof typeof DOCUMENT_JOBS, data: any, options = {}) {
    try {
      const job = await this.documentQueue.add(DOCUMENT_JOBS[type], data, {
        priority: JOB_PRIORITIES.MEDIUM,
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 2,
        ...options,
      });

      this.logger.info(`Document job added: ${type}`, { jobId: job.id, data });
      return job;
    } catch (error) {
      this.logger.error(`Failed to add document job: ${type}`, error, { data });
      throw error;
    }
  }

  async processUpload(arquivo: any) {
    return this.addDocumentProcessingJob('UPLOAD_PROCESS', { arquivo }, {
      priority: JOB_PRIORITIES.HIGH,
    });
  }

  async convertToPdf(documentoId: string) {
    return this.addDocumentProcessingJob('CONVERT_PDF', { documentoId });
  }

  async extractTextFromDocument(documentoId: string) {
    return this.addDocumentProcessingJob('EXTRACT_TEXT', { documentoId });
  }

  // ============================================================================
  // REPORT GENERATION JOBS
  // ============================================================================

  async addReportJob(type: keyof typeof REPORT_JOBS, data: any, options = {}) {
    try {
      const job = await this.reportQueue.add(REPORT_JOBS[type], data, {
        priority: JOB_PRIORITIES.LOW,
        removeOnComplete: 5,
        removeOnFail: 3,
        attempts: 2,
        delay: 5000, // 5 segundos de delay
        ...options,
      });

      this.logger.info(`Report job added: ${type}`, { jobId: job.id, data });
      return job;
    } catch (error) {
      this.logger.error(`Failed to add report job: ${type}`, error, { data });
      throw error;
    }
  }

  async generatePatientReport(pacienteId: string, opcoes = {}) {
    return this.addReportJob('GENERATE_PATIENT_REPORT', { pacienteId, opcoes });
  }

  async generateStatisticsReport(filtros = {}) {
    return this.addReportJob('GENERATE_STATISTICS_REPORT', { filtros }, {
      priority: JOB_PRIORITIES.MEDIUM,
    });
  }

  // ============================================================================
  // EMAIL SENDING JOBS
  // ============================================================================

  async addEmailJob(type: keyof typeof EMAIL_JOBS, data: any, options = {}) {
    try {
      const job = await this.emailQueue.add(EMAIL_JOBS[type], data, {
        priority: JOB_PRIORITIES.MEDIUM,
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        ...options,
      });

      this.logger.info(`Email job added: ${type}`, { jobId: job.id, data });
      return job;
    } catch (error) {
      this.logger.error(`Failed to add email job: ${type}`, error, { data });
      throw error;
    }
  }

  async sendWelcomeEmail(usuario: any) {
    return this.addEmailJob('SEND_WELCOME', { usuario }, {
      priority: JOB_PRIORITIES.HIGH,
    });
  }

  async sendNotification(destinatario: string, titulo: string, conteudo: string) {
    return this.addEmailJob('SEND_NOTIFICATION', { destinatario, titulo, conteudo });
  }

  async sendReport(destinatario: string, relatorio: any) {
    return this.addEmailJob('SEND_REPORT', { destinatario, relatorio });
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  async getJobById(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.getQueueByName(queueName);
    return queue ? await queue.getJob(jobId) : null;
  }

  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      const job = await this.getJobById(queueName, jobId);
      if (job) {
        await job.remove();
        this.logger.info(`Job removed: ${jobId} from ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to remove job ${jobId} from ${queueName}`, error);
      throw error;
    }
  }

  async retryJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      const job = await this.getJobById(queueName, jobId);
      if (job) {
        await job.retry();
        this.logger.info(`Job retried: ${jobId} from ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to retry job ${jobId} from ${queueName}`, error);
      throw error;
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.pause();
      this.logger.warn(`Queue paused: ${queueName}`);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.resume();
      this.logger.info(`Queue resumed: ${queueName}`);
    }
  }

  // ============================================================================
  // MONITORING & HEALTH
  // ============================================================================

  async getQueueStats(queueName: string): Promise<JobStats> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused() ? 1 : 0,
    };
  }

  async getAllQueuesHealth(): Promise<QueueHealth[]> {
    const queues = [
      { name: IA_QUEUE, queue: this.iaQueue },
      { name: DOCUMENT_QUEUE, queue: this.documentQueue },
      { name: REPORT_QUEUE, queue: this.reportQueue },
      { name: EMAIL_QUEUE, queue: this.emailQueue },
    ];

    const healthChecks = await Promise.all(
      queues.map(async ({ name, queue }) => {
        try {
          const stats = await this.getQueueStats(name);
          const errorRate = stats.failed / Math.max(stats.completed + stats.failed, 1);
          
          return {
            name,
            isHealthy: errorRate < 0.1 && stats.active < 100, // 10% error rate threshold
            stats,
            processorsActive: stats.active,
            errorRate: Math.round(errorRate * 100) / 100,
          };
        } catch (error) {
          this.logger.error(`Failed to get health for queue ${name}`, error);
          return {
            name,
            isHealthy: false,
            stats: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
            processorsActive: 0,
            errorRate: 1,
          };
        }
      })
    );

    return healthChecks;
  }

  async cleanOldJobs(): Promise<void> {
    try {
      const queues = [this.iaQueue, this.documentQueue, this.reportQueue, this.emailQueue];
      
      for (const queue of queues) {
        await queue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // Remove completed jobs older than 24h
        await queue.clean(7 * 24 * 60 * 60 * 1000, 20, 'failed'); // Remove failed jobs older than 7 days
      }

      this.logger.info('Old jobs cleaned successfully');
    } catch (error) {
      this.logger.error('Failed to clean old jobs', error);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getQueueByName(queueName: string): Queue | null {
    switch (queueName) {
      case IA_QUEUE:
        return this.iaQueue;
      case DOCUMENT_QUEUE:
        return this.documentQueue;
      case REPORT_QUEUE:
        return this.reportQueue;
      case EMAIL_QUEUE:
        return this.emailQueue;
      default:
        return null;
    }
  }

  private async setupQueues(): Promise<void> {
    // Configurar eventos globais das filas
    const queues = [this.iaQueue, this.documentQueue, this.reportQueue, this.emailQueue];
    
    for (const queue of queues) {
      queue.on('error', (error) => {
        this.logger.error(`Queue error in ${queue.name}`, error);
      });

      queue.on('waiting', (job) => {
        this.logger.debug(`Job waiting: ${job.id} in ${queue.name}`);
      });

      queue.on('stalled', (jobId) => {
        this.logger.warn(`Job stalled: ${jobId} in ${queue.name}`);
      });
    }
  }

  private async setupMonitoring(): Promise<void> {
    // Executar limpeza de jobs antigos a cada 6 horas
    setInterval(async () => {
      await this.cleanOldJobs();
    }, 6 * 60 * 60 * 1000);

    // Log de estatísticas a cada 30 minutos
    setInterval(async () => {
      try {
        const health = await this.getAllQueuesHealth();
        this.logger.info('Queue health check', { health });
      } catch (error) {
        this.logger.error('Failed to perform health check', error);
      }
    }, 30 * 60 * 1000);
  }
}