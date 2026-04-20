import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE, EMAIL_JOBS } from '../../core/constants/queues';
import { LoggerService } from '../../core/logger/logger.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

@Processor(EMAIL_QUEUE, {
  concurrency: 3,
  stalledInterval: 30 * 1000,
  maxStalledCount: 1,
})
@Injectable()
export class EmailProcessor extends WorkerHost {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
    this.setupTransporter();
  }

  async process(job: Job): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing email job: ${job.name}`, { 
        jobId: job.id, 
        data: job.data 
      });

      let result: any;

      switch (job.name) {
        case EMAIL_JOBS.SEND_WELCOME:
          result = await this.sendWelcome(job);
          break;
        
        case EMAIL_JOBS.SEND_NOTIFICATION:
          result = await this.sendNotification(job);
          break;
        
        case EMAIL_JOBS.SEND_REPORT:
          result = await this.sendReport(job);
          break;
        
        case EMAIL_JOBS.SEND_ALERT:
          result = await this.sendAlert(job);
          break;
        
        case EMAIL_JOBS.SEND_PASSWORD_RESET:
          result = await this.sendPasswordReset(job);
          break;
        
        case EMAIL_JOBS.SEND_BULK:
          result = await this.sendBulk(job);
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      
      this.logger.info(`Email job completed: ${job.name}`, {
        jobId: job.id,
        duration,
        success: true,
      });

      await this.saveJobHistory(job, result, duration, true);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Email job failed: ${job.name}`, error, {
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

  private async sendWelcome(job: Job): Promise<any> {
    const { usuario } = job.data;
    
    if (!usuario || !usuario.email) {
      throw new Error('Dados do usuário são obrigatórios');
    }

    await job.updateProgress(20);

    const template = this.getWelcomeTemplate(usuario);

    await job.updateProgress(50);

    const mailOptions = {
      from: this.config.get('MAIL_FROM', 'noreply@laboratorio.com'),
      to: usuario.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    const result = await this.transporter.sendMail(mailOptions);

    await job.updateProgress(90);

    // Salvar registro do email
    await this.prisma.emailLog.create({
      data: {
        destinatario: usuario.email,
        assunto: template.subject,
        tipo: 'WELCOME',
        status: 'ENVIADO',
        messageId: result.messageId,
        usuarioId: usuario.id,
      }
    });

    await job.updateProgress(100);

    return { 
      messageId: result.messageId, 
      destinatario: usuario.email,
      status: 'enviado'
    };
  }

  private async sendNotification(job: Job): Promise<any> {
    const { destinatario, titulo, conteudo } = job.data;
    
    if (!destinatario || !titulo || !conteudo) {
      throw new Error('Destinatário, título e conteúdo são obrigatórios');
    }

    await job.updateProgress(30);

    const template = this.getNotificationTemplate(titulo, conteudo);

    await job.updateProgress(60);

    const mailOptions = {
      from: this.config.get('MAIL_FROM', 'noreply@laboratorio.com'),
      to: destinatario,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    const result = await this.transporter.sendMail(mailOptions);

    await job.updateProgress(90);

    // Salvar registro
    await this.prisma.emailLog.create({
      data: {
        destinatario,
        assunto: template.subject,
        tipo: 'NOTIFICATION',
        status: 'ENVIADO',
        messageId: result.messageId,
      }
    });

    await job.updateProgress(100);

    return { 
      messageId: result.messageId, 
      destinatario,
      status: 'enviado'
    };
  }

  private async sendReport(job: Job): Promise<any> {
    const { destinatario, relatorio } = job.data;
    
    if (!destinatario || !relatorio) {
      throw new Error('Destinatário e relatório são obrigatórios');
    }

    await job.updateProgress(25);

    // Buscar dados do relatório
    const dadosRelatorio = await this.prisma.relatorio.findUnique({
      where: { id: relatorio.id }
    });

    if (!dadosRelatorio) {
      throw new Error(`Relatório não encontrado: ${relatorio.id}`);
    }

    await job.updateProgress(50);

    const template = this.getReportTemplate(dadosRelatorio);

    const mailOptions = {
      from: this.config.get('MAIL_FROM', 'noreply@laboratorio.com'),
      to: destinatario,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments: []
    };

    // Anexar arquivos se existirem
    if (dadosRelatorio.pdfPath) {
      mailOptions.attachments.push({
        filename: `${dadosRelatorio.titulo}.pdf`,
        path: dadosRelatorio.pdfPath,
      });
    }

    if (dadosRelatorio.excelPath) {
      mailOptions.attachments.push({
        filename: `${dadosRelatorio.titulo}.xlsx`,
        path: dadosRelatorio.excelPath,
      });
    }

    await job.updateProgress(75);

    const result = await this.transporter.sendMail(mailOptions);

    await job.updateProgress(90);

    // Salvar registro
    await this.prisma.emailLog.create({
      data: {
        destinatario,
        assunto: template.subject,
        tipo: 'REPORT',
        status: 'ENVIADO',
        messageId: result.messageId,
        attachments: mailOptions.attachments.map(att => att.filename).join(', '),
      }
    });

    await job.updateProgress(100);

    return { 
      messageId: result.messageId, 
      destinatario,
      attachments: mailOptions.attachments.length,
      status: 'enviado'
    };
  }

  private async sendAlert(job: Job): Promise<any> {
    const { destinatario, titulo, conteudo, prioridade = 'NORMAL' } = job.data;

    await job.updateProgress(40);

    const template = this.getAlertTemplate(titulo, conteudo, prioridade);

    const mailOptions = {
      from: this.config.get('MAIL_FROM', 'alerts@laboratorio.com'),
      to: destinatario,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: prioridade === 'CRITICA' ? 'high' : 'normal',
    };

    await job.updateProgress(70);

    const result = await this.transporter.sendMail(mailOptions);

    await job.updateProgress(90);

    // Salvar registro
    await this.prisma.emailLog.create({
      data: {
        destinatario,
        assunto: template.subject,
        tipo: 'ALERT',
        status: 'ENVIADO',
        messageId: result.messageId,
        prioridade,
      }
    });

    await job.updateProgress(100);

    return { 
      messageId: result.messageId, 
      destinatario,
      prioridade,
      status: 'enviado'
    };
  }

  private async sendPasswordReset(job: Job): Promise<any> {
    const { usuario, resetToken } = job.data;

    if (!usuario || !resetToken) {
      throw new Error('Dados do usuário e token são obrigatórios');
    }

    await job.updateProgress(30);

    const template = this.getPasswordResetTemplate(usuario, resetToken);

    await job.updateProgress(60);

    const mailOptions = {
      from: this.config.get('MAIL_FROM', 'security@laboratorio.com'),
      to: usuario.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    const result = await this.transporter.sendMail(mailOptions);

    await job.updateProgress(90);

    // Salvar registro
    await this.prisma.emailLog.create({
      data: {
        destinatario: usuario.email,
        assunto: template.subject,
        tipo: 'PASSWORD_RESET',
        status: 'ENVIADO',
        messageId: result.messageId,
        usuarioId: usuario.id,
      }
    });

    await job.updateProgress(100);

    return { 
      messageId: result.messageId, 
      destinatario: usuario.email,
      status: 'enviado'
    };
  }

  private async sendBulk(job: Job): Promise<any> {
    const { destinatarios, template, assunto } = job.data;

    if (!destinatarios || !template || !assunto) {
      throw new Error('Destinatários, template e assunto são obrigatórios');
    }

    const totalDestinatarios = destinatarios.length;
    let enviados = 0;
    let falhas = 0;

    const resultados = [];

    for (const [index, destinatario] of destinatarios.entries()) {
      try {
        await job.updateProgress(Math.floor((index / totalDestinatarios) * 100));

        const mailOptions = {
          from: this.config.get('MAIL_FROM', 'noreply@laboratorio.com'),
          to: destinatario.email,
          subject: this.personalizeTemplate(assunto, destinatario),
          html: this.personalizeTemplate(template.html, destinatario),
          text: this.personalizeTemplate(template.text, destinatario),
        };

        const result = await this.transporter.sendMail(mailOptions);

        // Salvar registro individual
        await this.prisma.emailLog.create({
          data: {
            destinatario: destinatario.email,
            assunto: mailOptions.subject,
            tipo: 'BULK',
            status: 'ENVIADO',
            messageId: result.messageId,
          }
        });

        resultados.push({
          destinatario: destinatario.email,
          status: 'enviado',
          messageId: result.messageId,
        });

        enviados++;

        // Pequeno delay para não sobrecarregar o servidor SMTP
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        this.logger.error(`Failed to send bulk email to ${destinatario.email}`, error);
        
        resultados.push({
          destinatario: destinatario.email,
          status: 'falha',
          erro: error.message,
        });

        falhas++;
      }
    }

    await job.updateProgress(100);

    return {
      totalDestinatarios,
      enviados,
      falhas,
      taxaSucesso: (enviados / totalDestinatarios) * 100,
      resultados,
    };
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  private getWelcomeTemplate(usuario: any): EmailTemplate {
    return {
      subject: `Bem-vindo ao Laboratório de Autoatendimento, ${usuario.name}!`,
      html: `
        <h1>Bem-vindo, ${usuario.name}!</h1>
        <p>Sua conta foi criada com sucesso em nosso sistema de laboratório de autoatendimento.</p>
        <p>Com sua conta você poderá:</p>
        <ul>
          <li>Fazer upload de documentos médicos</li>
          <li>Visualizar resultados de exames</li>
          <li>Gerar relatórios personalizados</li>
          <li>Acessar análises com inteligência artificial</li>
        </ul>
        <p>Para começar, <a href="${this.config.get('FRONTEND_URL')}/login">clique aqui para fazer login</a>.</p>
        <p>Atenciosamente,<br>Equipe Laboratório</p>
      `,
      text: `Bem-vindo, ${usuario.name}! Sua conta foi criada com sucesso. Acesse ${this.config.get('FRONTEND_URL')}/login para começar.`,
    };
  }

  private getNotificationTemplate(titulo: string, conteudo: string): EmailTemplate {
    return {
      subject: titulo,
      html: `
        <h2>${titulo}</h2>
        <div style="margin: 20px 0;">${conteudo}</div>
        <hr>
        <p><small>Esta é uma notificação automática do sistema.</small></p>
      `,
      text: `${titulo}\n\n${conteudo}\n\nEsta é uma notificação automática do sistema.`,
    };
  }

  private getReportTemplate(relatorio: any): EmailTemplate {
    return {
      subject: `Relatório Disponível: ${relatorio.titulo}`,
      html: `
        <h2>Seu relatório está pronto!</h2>
        <p><strong>Título:</strong> ${relatorio.titulo}</p>
        <p><strong>Tipo:</strong> ${relatorio.tipo}</p>
        <p><strong>Gerado em:</strong> ${new Date(relatorio.createdAt).toLocaleString()}</p>
        <p>O relatório foi anexado a este email nos formatos disponíveis.</p>
        <p>Atenciosamente,<br>Sistema de Relatórios</p>
      `,
      text: `Relatório disponível: ${relatorio.titulo}\nGerado em: ${new Date(relatorio.createdAt).toLocaleString()}`,
    };
  }

  private getAlertTemplate(titulo: string, conteudo: string, prioridade: string): EmailTemplate {
    const prioridadeEmoji = prioridade === 'CRITICA' ? '🚨' : prioridade === 'ALTA' ? '⚠️' : 'ℹ️';
    
    return {
      subject: `${prioridadeEmoji} ALERTA - ${titulo}`,
      html: `
        <div style="border-left: 4px solid ${prioridade === 'CRITICA' ? '#e74c3c' : '#f39c12'}; padding-left: 15px;">
          <h2 style="color: ${prioridade === 'CRITICA' ? '#e74c3c' : '#f39c12'};">${prioridadeEmoji} ${titulo}</h2>
          <p><strong>Prioridade:</strong> ${prioridade}</p>
          <div style="margin: 20px 0;">${conteudo}</div>
          <p><small>Gerado em: ${new Date().toLocaleString()}</small></p>
        </div>
      `,
      text: `ALERTA [${prioridade}] - ${titulo}\n\n${conteudo}\n\nGerado em: ${new Date().toLocaleString()}`,
    };
  }

  private getPasswordResetTemplate(usuario: any, resetToken: string): EmailTemplate {
    const resetUrl = `${this.config.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    
    return {
      subject: 'Redefinição de Senha - Laboratório',
      html: `
        <h2>Redefinição de Senha</h2>
        <p>Olá, ${usuario.name}!</p>
        <p>Recebemos uma solicitação para redefinir sua senha. Para continuar, clique no link abaixo:</p>
        <p><a href="${resetUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a></p>
        <p>Este link é válido por 24 horas.</p>
        <p>Se você não solicitou esta redefinição, ignore este email.</p>
        <p>Atenciosamente,<br>Equipe de Segurança</p>
      `,
      text: `Redefinição de Senha\n\nOlá, ${usuario.name}!\n\nPara redefinir sua senha, acesse: ${resetUrl}\n\nEste link é válido por 24 horas.`,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private personalizeTemplate(template: string, destinatario: any): string {
    return template
      .replace(/{{nome}}/g, destinatario.name || 'Usuário')
      .replace(/{{email}}/g, destinatario.email || '')
      .replace(/{{id}}/g, destinatario.id || '');
  }

  private setupTransporter(): void {
    this.transporter = nodemailer.createTransporter({
      host: this.config.get('MAIL_HOST', 'localhost'),
      port: this.config.get('MAIL_PORT', 587),
      secure: this.config.get('MAIL_SECURE', false),
      auth: {
        user: this.config.get('MAIL_USERNAME'),
        pass: this.config.get('MAIL_PASSWORD'),
      },
    });
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
          queueName: EMAIL_QUEUE,
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
    this.logger.info(`Email job completed: ${job.name}`, {
      jobId: job.id,
      destinatario: result.destinatario || 'bulk',
      messageId: result.messageId,
    });
  }

  async onFailed(job: Job, error: Error) {
    this.logger.error(`Email job failed: ${job.name}`, error, {
      jobId: job.id,
      attempts: job.attemptsMade,
      data: job.data,
    });
  }

  async onProgress(job: Job, progress: number | object) {
    this.logger.debug(`Email job progress: ${job.name}`, {
      jobId: job.id,
      progress,
    });
  }
}