import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { DOCUMENT_QUEUE, DOCUMENT_JOBS } from '../../core/constants/queues';
import { LoggerService } from '../../core/logger/logger.service';
import { PrismaService } from '../../core/database/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sharp from 'sharp';
import * as pdf2pic from 'pdf2pic';
import * as pdfParse from 'pdf-parse';

@Processor(DOCUMENT_QUEUE, {
  concurrency: 3,
  stalledInterval: 30 * 1000,
  maxStalledCount: 1,
})
@Injectable()
export class DocumentProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing document job: ${job.name}`, { 
        jobId: job.id, 
        data: job.data 
      });

      let result: any;

      switch (job.name) {
        case DOCUMENT_JOBS.UPLOAD_PROCESS:
          result = await this.processUpload(job);
          break;
        
        case DOCUMENT_JOBS.CONVERT_PDF:
          result = await this.convertPdf(job);
          break;
        
        case DOCUMENT_JOBS.EXTRACT_TEXT:
          result = await this.extractText(job);
          break;
        
        case DOCUMENT_JOBS.GENERATE_THUMBNAIL:
          result = await this.generateThumbnail(job);
          break;
        
        case DOCUMENT_JOBS.VIRUS_SCAN:
          result = await this.virusScan(job);
          break;
        
        case DOCUMENT_JOBS.COMPRESS_FILE:
          result = await this.compressFile(job);
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      
      this.logger.info(`Document job completed: ${job.name}`, {
        jobId: job.id,
        duration,
        success: true,
      });

      await this.saveJobHistory(job, result, duration, true);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Document job failed: ${job.name}`, error, {
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

  private async processUpload(job: Job): Promise<any> {
    const { arquivo } = job.data;
    
    if (!arquivo) {
      throw new Error('Arquivo é obrigatório');
    }

    await job.updateProgress(10);

    // Validar arquivo
    const validacao = await this.validateFile(arquivo);
    if (!validacao.valido) {
      throw new Error(`Arquivo inválido: ${validacao.erro}`);
    }

    await job.updateProgress(30);

    // Criar entrada no banco
    const documento = await this.prisma.documento.create({
      data: {
        nome: arquivo.nome,
        nomeOriginal: arquivo.nomeOriginal,
        tipoMime: arquivo.tipoMime,
        tamanho: arquivo.tamanho,
        caminho: arquivo.caminho,
        hash: arquivo.hash,
        usuarioId: arquivo.usuarioId,
        status: 'PROCESSANDO',
      }
    });

    await job.updateProgress(60);

    // Gerar thumbnail se for imagem ou PDF
    if (this.isImageFile(arquivo.tipoMime) || arquivo.tipoMime === 'application/pdf') {
      await this.generateThumbnailForDocument(documento.id, arquivo.caminho);
    }

    await job.updateProgress(80);

    // Extrair texto se for PDF
    if (arquivo.tipoMime === 'application/pdf') {
      await this.extractTextFromPdf(documento.id, arquivo.caminho);
    }

    await job.updateProgress(90);

    // Atualizar status
    await this.prisma.documento.update({
      where: { id: documento.id },
      data: {
        status: 'PROCESSADO',
        processedAt: new Date(),
      }
    });

    await job.updateProgress(100);

    return { documentoId: documento.id, processado: true };
  }

  private async convertPdf(job: Job): Promise<any> {
    const { documentoId } = job.data;
    
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId }
    });

    if (!documento) {
      throw new Error(`Documento não encontrado: ${documentoId}`);
    }

    await job.updateProgress(20);

    // Implementar conversão para PDF (se necessário)
    // Por ora, apenas marcamos como processado
    const pdfPath = documento.caminho.replace(path.extname(documento.caminho), '.pdf');

    await job.updateProgress(80);

    // Atualizar documento
    await this.prisma.documento.update({
      where: { id: documentoId },
      data: {
        pdfPath,
        status: 'CONVERTIDO',
      }
    });

    await job.updateProgress(100);

    return { documentoId, pdfPath };
  }

  private async extractText(job: Job): Promise<any> {
    const { documentoId } = job.data;
    
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId }
    });

    if (!documento) {
      throw new Error(`Documento não encontrado: ${documentoId}`);
    }

    await job.updateProgress(30);

    let textoExtraido = '';

    if (documento.tipoMime === 'application/pdf') {
      textoExtraido = await this.extractTextFromPdfFile(documento.caminho);
    } else {
      throw new Error(`Tipo de arquivo não suportado para extração de texto: ${documento.tipoMime}`);
    }

    await job.updateProgress(80);

    // Salvar texto extraído
    await this.prisma.documento.update({
      where: { id: documentoId },
      data: {
        textoExtraido,
        status: 'TEXTO_EXTRAIDO',
      }
    });

    await job.updateProgress(100);

    return { documentoId, textoExtraido: textoExtraido.substring(0, 500) + '...' };
  }

  private async generateThumbnail(job: Job): Promise<any> {
    const { documentoId } = job.data;
    
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId }
    });

    if (!documento) {
      throw new Error(`Documento não encontrado: ${documentoId}`);
    }

    await job.updateProgress(40);

    const thumbnailPath = await this.generateThumbnailForDocument(documentoId, documento.caminho);

    await job.updateProgress(80);

    // Atualizar documento
    await this.prisma.documento.update({
      where: { id: documentoId },
      data: {
        thumbnailPath,
        status: 'THUMBNAIL_GERADO',
      }
    });

    await job.updateProgress(100);

    return { documentoId, thumbnailPath };
  }

  private async virusScan(job: Job): Promise<any> {
    const { documentoId } = job.data;
    
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId }
    });

    if (!documento) {
      throw new Error(`Documento não encontrado: ${documentoId}`);
    }

    await job.updateProgress(50);

    // Implementar scan de vírus (ClamAV, etc.)
    // Por ora, simulamos o scan
    const scanResult = {
      limpo: true,
      virus: null,
      scanTime: new Date(),
    };

    await job.updateProgress(80);

    // Atualizar documento
    await this.prisma.documento.update({
      where: { id: documentoId },
      data: {
        virusScanResult: JSON.stringify(scanResult),
        status: scanResult.limpo ? 'LIMPO' : 'INFECTADO',
      }
    });

    await job.updateProgress(100);

    return { documentoId, scanResult };
  }

  private async compressFile(job: Job): Promise<any> {
    const { documentoId } = job.data;
    
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId }
    });

    if (!documento) {
      throw new Error(`Documento não encontrado: ${documentoId}`);
    }

    await job.updateProgress(30);

    // Implementar compressão de arquivo
    const compressedPath = documento.caminho.replace(path.extname(documento.caminho), '_compressed' + path.extname(documento.caminho));
    
    // Simular compressão copiando arquivo
    await fs.copyFile(documento.caminho, compressedPath);

    await job.updateProgress(80);

    // Atualizar documento
    await this.prisma.documento.update({
      where: { id: documentoId },
      data: {
        compressedPath,
        status: 'COMPRIMIDO',
      }
    });

    await job.updateProgress(100);

    return { documentoId, compressedPath };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async validateFile(arquivo: any): Promise<{ valido: boolean; erro?: string }> {
    try {
      // Verificar se arquivo existe
      await fs.access(arquivo.caminho);
      
      // Verificar tamanho máximo (100MB)
      if (arquivo.tamanho > 100 * 1024 * 1024) {
        return { valido: false, erro: 'Arquivo muito grande (máximo 100MB)' };
      }

      // Verificar tipos MIME permitidos
      const tiposPermitidos = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (!tiposPermitidos.includes(arquivo.tipoMime)) {
        return { valido: false, erro: 'Tipo de arquivo não suportado' };
      }

      return { valido: true };

    } catch (error) {
      return { valido: false, erro: 'Arquivo não encontrado ou inacessível' };
    }
  }

  private isImageFile(tipoMime: string): boolean {
    return tipoMime.startsWith('image/');
  }

  private async generateThumbnailForDocument(documentoId: string, caminhoArquivo: string): Promise<string> {
    try {
      const thumbnailDir = path.join(path.dirname(caminhoArquivo), 'thumbnails');
      await fs.mkdir(thumbnailDir, { recursive: true });
      
      const thumbnailPath = path.join(thumbnailDir, `${documentoId}_thumb.jpg`);

      const fileExtension = path.extname(caminhoArquivo).toLowerCase();

      if (fileExtension === '.pdf') {
        // Gerar thumbnail do PDF
        const convert = pdf2pic.fromPath(caminhoArquivo, {
          density: 100,
          saveFilename: `${documentoId}_thumb`,
          savePath: thumbnailDir,
          format: 'jpg',
          width: 300,
          height: 400
        });

        await convert(1); // Primeira página
      } else if (this.isImageFile(path.extname(caminhoArquivo))) {
        // Redimensionar imagem
        await sharp(caminhoArquivo)
          .resize(300, 400, { fit: 'inside' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);
      }

      return thumbnailPath;

    } catch (error) {
      this.logger.error('Failed to generate thumbnail', error, { documentoId, caminhoArquivo });
      throw error;
    }
  }

  private async extractTextFromPdf(documentoId: string, pdfPath: string): Promise<void> {
    try {
      const texto = await this.extractTextFromPdfFile(pdfPath);
      
      await this.prisma.documento.update({
        where: { id: documentoId },
        data: { textoExtraido: texto }
      });

    } catch (error) {
      this.logger.error('Failed to extract text from PDF', error, { documentoId, pdfPath });
    }
  }

  private async extractTextFromPdfFile(pdfPath: string): Promise<string> {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      this.logger.error('Failed to parse PDF file', error, { pdfPath });
      throw error;
    }
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
          queueName: DOCUMENT_QUEUE,
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
    this.logger.info(`Document job completed: ${job.name}`, {
      jobId: job.id,
      result: typeof result === 'object' ? Object.keys(result) : result
    });
  }

  async onFailed(job: Job, error: Error) {
    this.logger.error(`Document job failed: ${job.name}`, error, {
      jobId: job.id,
      attempts: job.attemptsMade,
      data: job.data
    });
  }

  async onProgress(job: Job, progress: number | object) {
    this.logger.debug(`Document job progress: ${job.name}`, {
      jobId: job.id,
      progress
    });
  }
}