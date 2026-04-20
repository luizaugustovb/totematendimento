import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  ForbiddenException 
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { WorkerService } from '../../workers/worker.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { QueryDocumentoDto } from './dto/query-documento.dto';
import { UploadResponseDto, MultiUploadResponseDto } from './dto/upload-response.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mime from 'mime-types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly workerService: WorkerService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================================
  // UPLOAD DE ARQUIVOS
  // ============================================================================

  async uploadSingle(
    file: Express.Multer.File,
    createDto: CreateDocumentoDto,
    usuarioId: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Arquivo é obrigatório');
    }

    try {
      // Gerar hash do arquivo para verificação de integridade
      const fileBuffer = await fs.readFile(file.path);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Verificar se arquivo já existe (mesmo hash)
      const existing = await this.prisma.documento.findFirst({
        where: { hash, usuarioId }
      });

      if (existing) {
        // Remover arquivo duplicado
        await fs.unlink(file.path);
        throw new BadRequestException('Arquivo já existe no sistema');
      }

      // Criar entrada no banco
      const documento = await this.prisma.documento.create({
        data: {
          nome: createDto.nome || file.originalname,
          nomeOriginal: file.originalname,
          nomeArquivo: file.filename,
          caminho: file.path,
          tipoMime: file.mimetype,
          tamanho: file.size,
          hash,
          tipo: createDto.tipo,
          descricao: createDto.descricao,
          tags: createDto.tags || [],
          metadados: createDto.metadados || {},
          usuarioId,
          status: 'PENDENTE',
        },
      });

      this.logger.info('Document uploaded', { 
        documentoId: documento.id, 
        usuarioId,
        filename: file.originalname,
        size: file.size
      });

      // Iniciar processamento assíncrono
      await this.workerService.processUpload({
        arquivo: {
          nome: documento.nome,
          nomeOriginal: documento.nomeOriginal,
          tipoMime: documento.tipoMime,
          tamanho: documento.tamanho,
          caminho: documento.caminho,
          hash: documento.hash,
          usuarioId,
        }
      });

      // Retornar resposta
      return new UploadResponseDto({
        id: documento.id,
        nomeOriginal: documento.nomeOriginal,
        nomeArquivo: documento.nomeArquivo,
        tipoMime: documento.tipoMime,
        tamanho: documento.tamanho,
        status: documento.status,
        hash: documento.hash,
        criadoEm: documento.createdAt,
        urlDownload: `/api/documentos/${documento.id}/download`,
      });

    } catch (error) {
      // Limpar arquivo em caso de erro
      if (file?.path) {
        try {
          await fs.unlink(file.path);
        } catch {}
      }

      this.logger.error('Failed to upload document', error, { 
        usuarioId, 
        filename: file?.originalname 
      });
      throw error;
    }
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    createDto: CreateDocumentoDto,
    usuarioId: string,
  ): Promise<MultiUploadResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Pelo menos um arquivo é obrigatório');
    }

    const sucessos: UploadResponseDto[] = [];
    const falhas: Array<{ nomeOriginal: string; erro: string }> = [];

    for (const file of files) {
      try {
        const result = await this.uploadSingle(file, createDto, usuarioId);
        sucessos.push(result);
      } catch (error) {
        falhas.push({
          nomeOriginal: file.originalname,
          erro: error.message,
        });
      }
    }

    return {
      sucessos,
      falhas,
      total: files.length,
      sucessoCount: sucessos.length,
      falhaCount: falhas.length,
    };
  }

  async uploadTemp(file: Express.Multer.File, usuarioId: string) {
    if (!file) {
      throw new BadRequestException('Arquivo é obrigatório');
    }

    try {
      const hash = crypto.createHash('sha256')
        .update(await fs.readFile(file.path))
        .digest('hex');

      // Arquivo temporário - não salva no banco, apenas retorna info
      const tempInfo = {
        id: crypto.randomUUID(),
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        tipoMime: file.mimetype,
        tamanho: file.size,
        hash,
        caminho: file.path,
        temporario: true,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
      };

      // Agendar limpeza do arquivo temporário
      setTimeout(async () => {
        try {
          await fs.unlink(file.path);
        } catch {}
      }, 60 * 60 * 1000);

      return tempInfo;

    } catch (error) {
      if (file?.path) {
        try {
          await fs.unlink(file.path);
        } catch {}
      }
      throw error;
    }
  }

  // ============================================================================
  // CRUD BÁSICO
  // ============================================================================

  async findAll(query: QueryDocumentoDto, usuarioId: string) {
    const {
      search,
      tipo,
      status,
      dataInicio,
      dataFim,
      ordenarPor = 'createdAt',
      direcao = 'desc',
      pagina = 1,
      limite = 20,
    } = query;

    const where: any = { usuarioId };

    // Filtros
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
        { nomeOriginal: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tipo) where.tipo = tipo;
    if (status) where.status = status;

    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) where.createdAt.gte = new Date(dataInicio);
      if (dataFim) where.createdAt.lte = new Date(dataFim + 'T23:59:59.999Z');
    }

    // Paginação
    const skip = (pagina - 1) * limite;
    
    const [documentos, total] = await Promise.all([
      this.prisma.documento.findMany({
        where,
        skip,
        take: limite,
        orderBy: { [ordenarPor]: direcao },
        include: {
          usuario: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      this.prisma.documento.count({ where }),
    ]);

    return {
      data: documentos.map(doc => this.formatDocumentResponse(doc)),
      pagination: {
        pagina,
        limite,
        total,
        paginas: Math.ceil(total / limite),
        temProxima: skip + limite < total,
        temAnterior: pagina > 1,
      },
    };
  }

  async search(searchTerm: string, query: QueryDocumentoDto, usuarioId: string) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException('Termo de busca deve ter ao menos 2 caracteres');
    }

    // Busca mais avançada incluindo texto extraído
    const where: any = {
      usuarioId,
      OR: [
        { nome: { contains: searchTerm, mode: 'insensitive' } },
        { descricao: { contains: searchTerm, mode: 'insensitive' } },
        { nomeOriginal: { contains: searchTerm, mode: 'insensitive' } },
        { textoExtraido: { contains: searchTerm, mode: 'insensitive' } },
        { tags: { hasSome: [searchTerm] } }
      ],
    };

    // Aplicar outros filtros
    if (query.tipo) where.tipo = query.tipo;
    if (query.status) where.status = query.status;

    const documentos = await this.prisma.documento.findMany({
      where,
      take: query.limite || 20,
      orderBy: { createdAt: 'desc' },
    });

    return {
      termo: searchTerm,
      resultados: documentos.length,
      documentos: documentos.map(doc => this.formatDocumentResponse(doc)),
    };
  }

  async findOne(id: string, usuarioId: string) {
    const documento = await this.prisma.documento.findFirst({
      where: { id, usuarioId },
      include: {
        usuario: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!documento) {
      throw new NotFoundException('Documento não encontrado');
    }

    return this.formatDocumentResponse(documento);
  }

  async update(id: string, updateDto: UpdateDocumentoDto, usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    const updated = await this.prisma.documento.update({
      where: { id },
      data: {
        ...updateDto,
        updatedAt: new Date(),
      },
    });

    this.logger.info('Document updated', { 
      documentoId: id, 
      usuarioId,
      changes: Object.keys(updateDto)
    });

    return this.formatDocumentResponse(updated);
  }

  async remove(id: string, usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    // Remover arquivo físico
    try {
      await fs.unlink(documento.caminho);
      
      // Remover thumbnail se existir
      if (documento.thumbnailPath) {
        await fs.unlink(documento.thumbnailPath);
      }
    } catch (error) {
      this.logger.warn('Failed to remove file from disk', error, { documentoId: id });
    }

    // Remover do banco
    await this.prisma.documento.delete({ where: { id } });

    this.logger.info('Document removed', { documentoId: id, usuarioId });

    return { id, removido: true, timestamp: new Date() };
  }

  // ============================================================================
  // DOWNLOAD E VISUALIZAÇÃO
  // ============================================================================

  async download(id: string, usuarioId: string, res: Response) {
    const documento = await this.findOne(id, usuarioId);

    try {
      const stat = await fs.stat(documento.caminho);
      
      res.setHeader('Content-Type', documento.tipoMime);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${documento.nomeOriginal}"`);
      
      const fileStream = require('fs').createReadStream(documento.caminho);
      fileStream.pipe(res);

      this.logger.info('Document downloaded', { documentoId: id, usuarioId });

    } catch (error) {
      this.logger.error('Failed to download document', error, { documentoId: id });
      throw new NotFoundException('Arquivo não encontrado no servidor');
    }
  }

  async getThumbnail(id: string, usuarioId: string, res: Response) {
    const documento = await this.findOne(id, usuarioId);

    if (!documento.thumbnailPath) {
      throw new NotFoundException('Thumbnail não disponível para este documento');
    }

    try {
      const stat = await fs.stat(documento.thumbnailPath);
      
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      const fileStream = require('fs').createReadStream(documento.thumbnailPath);
      fileStream.pipe(res);

    } catch (error) {
      throw new NotFoundException('Thumbnail não encontrado');
    }
  }

  async preview(id: string, usuarioId: string, res: Response) {
    const documento = await this.findOne(id, usuarioId);

    // Para imagens, mostrar diretamente
    if (documento.tipoMime.startsWith('image/')) {
      return this.download(id, usuarioId, res);
    }

    // Para PDFs, mostrar o arquivo
    if (documento.tipoMime === 'application/pdf') {
      try {
        const stat = await fs.stat(documento.caminho);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', 'inline');
        
        const fileStream = require('fs').createReadStream(documento.caminho);
        fileStream.pipe(res);
      } catch (error) {
        throw new NotFoundException('Arquivo não encontrado');
      }
    } else {
      throw new BadRequestException('Preview não suportado para este tipo de arquivo');
    }
  }

  // ============================================================================
  // PROCESSAMENTO E IA
  // ============================================================================

  async processWithIA(id: string, opcoes: any, usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    if (documento.status === 'PROCESSANDO') {
      throw new BadRequestException('Documento já está sendo processado');
    }

    // Atualizar status
    await this.prisma.documento.update({
      where: { id },
      data: { status: 'PROCESSANDO' },
    });

    // Iniciar processamento com IA
    const job = await this.workerService.interpretDocument(id);

    this.logger.info('Document IA processing started', { 
      documentoId: id, 
      usuarioId,
      jobId: job.id 
    });

    return {
      documentoId: id,
      jobId: job.id,
      status: 'PROCESSANDO',
      iniciado: new Date(),
    };
  }

  async getProcessingStatus(id: string, usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    // Buscar jobs relacionados
    const jobs = await this.prisma.jobHistory.findMany({
      where: {
        jobData: {
          contains: id,
        },
      },
      orderBy: { processedAt: 'desc' },
      take: 5,
    });

    return {
      documentoId: id,
      status: documento.status,
      processedAt: documento.processedAt,
      jobs: jobs.map(job => ({
        id: job.id,
        type: job.jobName,
        status: job.success ? 'SUCCESS' : 'FAILED',
        duration: job.duration,
        error: job.error,
        processedAt: job.processedAt,
      })),
    };
  }

  async getExtractedText(id: string, usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    return {
      documentoId: id,
      textoExtraido: documento.textoExtraido || null,
      temTexto: !!documento.textoExtraido,
      tamanhoTexto: documento.textoExtraido?.length || 0,
      extraidoEm: documento.processedAt,
    };
  }

  // ============================================================================
  // ESTATÍSTICAS E RELATÓRIOS
  // ============================================================================

  async getStats(usuarioId: string) {
    const [
      total,
      porStatus,
      porTipo,
      tamanhoTotal,
      recentes
    ] = await Promise.all([
      this.prisma.documento.count({ where: { usuarioId } }),
      this.prisma.documento.groupBy({
        by: ['status'],
        where: { usuarioId },
        _count: { id: true },
      }),
      this.prisma.documento.groupBy({
        by: ['tipo'],
        where: { usuarioId },
        _count: { id: true },
      }),
      this.prisma.documento.aggregate({
        where: { usuarioId },
        _sum: { tamanho: true },
      }),
      this.prisma.documento.count({
        where: {
          usuarioId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias
          },
        },
      }),
    ]);

    return {
      total,
      recentes,
      tamanhoTotal: tamanhoTotal._sum.tamanho || 0,
      porStatus,
      porTipo,
      geradoEm: new Date(),
    };
  }

  async getStorageStats(usuarioId: string) {
    const stats = await this.getStats(usuarioId);
    const limite = this.config.get('USER_STORAGE_LIMIT', 5 * 1024 * 1024 * 1024); // 5GB

    return {
      usado: stats.tamanhoTotal,
      limite,
      percentualUso: (stats.tamanhoTotal / limite) * 100,
      livre: limite - stats.tamanhoTotal,
      formatado: {
        usado: this.formatBytes(stats.tamanhoTotal),
        limite: this.formatBytes(limite),
        livre: this.formatBytes(limite - stats.tamanhoTotal),
      },
    };
  }

  async getRecent(limite: number, usuarioId: string) {
    const documentos = await this.prisma.documento.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });

    return {
      documentos: documentos.map(doc => this.formatDocumentResponse(doc)),
      total: documentos.length,
    };
  }

  // ============================================================================
  // ORGANIZAÇÃO
  // ============================================================================

  async organize(id: string, usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    // Usar IA para classificar automaticamente
    const job = await this.workerService.addIaProcessingJob('CLASSIFY_DOCUMENT', {
      documentoId: id,
    });

    return {
      documentoId: id,
      organizationJobId: job.id,
      status: 'ORGANIZANDO',
      iniciado: new Date(),
    };
  }

  async updateTags(id: string, tags: string[], usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    const updated = await this.prisma.documento.update({
      where: { id },
      data: { tags },
    });

    return {
      documentoId: id,
      tags: updated.tags,
      atualizado: new Date(),
    };
  }

  // ============================================================================
  // COMPARTILHAMENTO
  // ============================================================================

  async generateShareLink(id: string, expiresInHours: number, usuarioId: string) {
    const documento = await this.findOne(id, usuarioId);

    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Salvar token de compartilhamento (seria em uma tabela separada)
    const shareData = {
      token: shareToken,
      documentoId: id,
      usuarioId,
      expiresAt,
      createdAt: new Date(),
    };

    // Por ora, apenas retorna - implementar tabela de shares depois
    return {
      documentoId: id,
      shareUrl: `${this.config.get('FRONTEND_URL')}/share/${shareToken}`,
      expiresAt,
      token: shareToken,
    };
  }

  // ============================================================================
  // HELPERS PRIVADOS
  // ============================================================================

  private formatDocumentResponse(documento: any) {
    return {
      id: documento.id,
      nome: documento.nome,
      nomeOriginal: documento.nomeOriginal,
      nomeArquivo: documento.nomeArquivo,
      tipoMime: documento.tipoMime,
      tamanho: documento.tamanho,
      tamanhoFormatado: this.formatBytes(documento.tamanho),
      tipo: documento.tipo,
      status: documento.status,
      descricao: documento.descricao,
      tags: documento.tags,
      hash: documento.hash,
      temThumbnail: !!documento.thumbnailPath,
      temTextoExtraido: !!documento.textoExtraido,
      createdAt: documento.createdAt,
      updatedAt: documento.updatedAt,
      processedAt: documento.processedAt,
      urls: {
        download: `/api/documentos/${documento.id}/download`,
        thumbnail: documento.thumbnailPath ? `/api/documentos/${documento.id}/thumbnail` : null,
        preview: `/api/documentos/${documento.id}/preview`,
      },
      usuario: documento.usuario ? {
        id: documento.usuario.id,
        nome: documento.usuario.name,
        email: documento.usuario.email,
      } : undefined,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}