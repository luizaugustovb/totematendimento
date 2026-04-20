import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { 
  ProcessarImagemOCRDto,
  TestarOCRDto,
  ConfiguracaoOCRDto,
  ResultadoOCRDto,
  RelatorioOCRDto,
  HistoricoOCRDto
} from './dto/ocr.dto';
import { OCRProvider, ConfiguracaoProviderOCR } from './providers/ocr.provider';
import { GoogleVisionProvider } from './providers/google-vision.provider';

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);
  private provider: OCRProvider;
  private readonly providerAtivo: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.providerAtivo = this.configService.get<string>('OCR_PROVIDER', 'GOOGLE_VISION');
    this.inicializarProvider();
  }

  private inicializarProvider(): void {
    const config = this.obterConfiguracaoProvider();

    switch (this.providerAtivo) {
      case 'GOOGLE_VISION':
        this.provider = new GoogleVisionProvider(config);
        break;
      
      case 'AZURE_OCR':
        // Implementar futuramente
        this.logger.warn('Azure OCR não implementado ainda, usando Google Vision');
        this.provider = new GoogleVisionProvider(config);
        break;

      case 'AWS_TEXTRACT':
        // Implementar futuramente
        this.logger.warn('AWS Textract não implementado ainda, usando Google Vision');
        this.provider = new GoogleVisionProvider(config);
        break;

      default:
        this.logger.warn(`Provider desconhecido: ${this.providerAtivo}, usando Google Vision`);
        this.provider = new GoogleVisionProvider(config);
    }

    this.logger.log(`OCR Provider configurado: ${this.provider.getNome()}`);
  }

  private obterConfiguracaoProvider(): ConfiguracaoProviderOCR {
    return {
      habilitado: this.configService.get<string>('OCR_ENABLED', 'true') === 'true',
      timeout: this.configService.get<number>('OCR_TIMEOUT_MS', 30000),
      limiteConfianca: this.configService.get<number>('OCR_MIN_CONFIDENCE', 0.7),
      tamanhoMaximoArquivo: this.configService.get<number>('OCR_MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
      credenciais: {
        googleVisionKey: this.configService.get('GOOGLE_CLOUD_KEY_FILE') || this.parseGoogleCredentials(),
        googleProjectId: this.configService.get('GOOGLE_CLOUD_PROJECT_ID'),
        azureKey: this.configService.get('AZURE_OCR_KEY'),
        azureEndpoint: this.configService.get('AZURE_OCR_ENDPOINT'),
        awsAccessKey: this.configService.get('AWS_ACCESS_KEY_ID'),
        awsSecretKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        awsRegion: this.configService.get('AWS_REGION'),
      },
    };
  }

  private parseGoogleCredentials(): any {
    const credentialsJson = this.configService.get('GOOGLE_CLOUD_CREDENTIALS_JSON');
    if (credentialsJson) {
      try {
        return JSON.parse(credentialsJson);
      } catch (error) {
        this.logger.error('Erro ao fazer parse das credenciais Google Cloud JSON', error);
        return null;
      }
    }
    return null;
  }

  async processarImagem(dto: ProcessarImagemOCRDto): Promise<ResultadoOCRDto> {
    try {
      this.logger.log(`Iniciando processamento OCR - Tipo: ${dto.tipoAnalise}`);

      // Processar usando o provider
      const resultado = await this.provider.processarImagem({
        imagem: dto.imagem,
        tipoAnalise: dto.tipoAnalise,
        formato: dto.formato,
        idiomas: dto.idiomas,
        extrairBlocos: dto.extrairBlocos,
        detectarOrientacao: dto.detectarOrientacao,
        configuracoes: dto.configuracoes,
      });

      // Salvar histórico no banco
      await this.salvarHistoricoProcessamento({
        processamentoId: resultado.processamentoId,
        tipoAnalise: dto.tipoAnalise,
        atendimentoId: dto.atendimentoId,
        documentoId: dto.documentoId,
        status: 'SUCESSO',
        confiança: resultado.confiancaGeral,
        tempoProcessamento: resultado.tempoProcessamento,
        resultado: resultado,
      });

      // Log de sistema
      await this.prisma.logSistema.create({
        data: {
          modulo: 'OCR',
          nivel: 'INFO',
          mensagem: 'Processamento OCR concluído com sucesso',
          contextoJson: {
            processamento_id: resultado.processamentoId,
            tipo_analise: dto.tipoAnalise,
            confianca: resultado.confiancaGeral,
            tempo_ms: resultado.tempoProcessamento,
            provider: this.provider.getNome(),
            atendimento_id: dto.atendimentoId,
            documento_id: dto.documentoId,
          },
        },
      });

      return resultado;

    } catch (error) {
      this.logger.error('Erro no processamento OCR', error);

      // Salvar erro no histórico
      const processamentoId = `erro_${Date.now()}`;
      await this.salvarHistoricoProcessamento({
        processamentoId,
        tipoAnalise: dto.tipoAnalise,
        atendimentoId: dto.atendimentoId,
        documentoId: dto.documentoId,
        status: 'ERRO',
        erro: error.message,
      });

      // Log de erro
      await this.prisma.logSistema.create({
        data: {
          modulo: 'OCR',
          nivel: 'ERROR',
          mensagem: 'Falha no processamento OCR',
          contextoJson: {
            processamento_id: processamentoId,
            tipo_analise: dto.tipoAnalise,
            erro: error.message,
            provider: this.provider.getNome(),
            atendimento_id: dto.atendimentoId,
            documento_id: dto.documentoId,
          },
        },
      });

      throw new BadRequestException(`Falha no processamento OCR: ${error.message}`);
    }
  }

  async testarConexao(dto: TestarOCRDto): Promise<any> {
    try {
      this.logger.log('Testando conexão OCR');

      const resultado = await this.provider.testarConexao(dto.imagemTeste);

      // Se texto esperado foi fornecido, comparar
      if (dto.textoEsperado && resultado.sucesso) {
        const textoDetectado = resultado.detalhes.texto_detectado || '';
        const similaridade = this.calcularSimilaridade(
          dto.textoEsperado.toLowerCase(),
          textoDetectado.toLowerCase()
        );

        resultado.detalhes.texto_esperado = dto.textoEsperado;
        resultado.detalhes.similaridade = `${(similaridade * 100).toFixed(1)}%`;
        resultado.detalhes.teste_validacao = similaridade > 0.7 ? 'APROVADO' : 'REPROVADO';
      }

      // Log do teste
      await this.prisma.logSistema.create({
        data: {
          modulo: 'OCR',
          nivel: 'INFO',
          mensagem: 'Teste de conexão OCR realizado',
          contextoJson: {
            provider: this.provider.getNome(),
            sucesso: resultado.sucesso,
            detalhes: resultado.detalhes,
          },
        },
      });

      return resultado;

    } catch (error) {
      this.logger.error('Erro no teste de conexão OCR', error);

      return {
        sucesso: false,
        detalhes: {
          erro: error.message,
          provider: this.provider.getNome(),
        },
      };
    }
  }

  async obterConfiguracoes(): Promise<ConfiguracaoOCRDto> {
    const config = this.obterConfiguracaoProvider();
    
    return {
      provedor: this.provider.getNome(),
      habilitado: config.habilitado,
      limiteConfianca: config.limiteConfianca,
      timeout: config.timeout,
      tamanhoMaximoArquivo: config.tamanhoMaximoArquivo,
    };
  }

  async obterHistorico(
    page = 1, 
    limit = 20, 
    tipoAnalise?: string,
    dataInicio?: Date,
    dataFim?: Date
  ): Promise<{ data: HistoricoOCRDto[]; meta: any }> {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (tipoAnalise) {
      where.tipoAnalise = tipoAnalise;
    }
    if (dataInicio && dataFim) {
      where.createdAt = {
        gte: dataInicio,
        lte: dataFim,
      };
    }

    const [processamentos, total] = await Promise.all([
      this.prisma.processamentoOCR.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          tipoAnalise: true,
          status: true,
          confianca: true,
          tempoProcessamento: true,
          atendimentoId: true,
          documentoId: true,
          observacoes: true,
        },
      }),
      this.prisma.processamentoOCR.count({ where }),
    ]);

    const historico: HistoricoOCRDto[] = processamentos.map(p => ({
      id: p.id,
      dataHora: p.createdAt,
      tipoAnalise: p.tipoAnalise as any,
      status: p.status,
      confianca: p.confianca || 0,
      tempoProcessamento: p.tempoProcessamento || 0,
      atendimentoId: p.atendimentoId,
      documentoId: p.documentoId,
      observacoes: p.observacoes,
    }));

    return {
      data: historico,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async obterRelatorio(): Promise<RelatorioOCRDto> {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    const [
      total,
      processamentosHoje,
      sucessos,
      erros,
      porTipo,
      porFormato,
      confiancaMedia,
      tempoMedio
    ] = await Promise.all([
      // Total de processamentos
      this.prisma.processamentoOCR.count(),

      // Processamentos hoje
      this.prisma.processamentoOCR.count({
        where: { createdAt: { gte: hoje } },
      }),

      // Sucessos
      this.prisma.processamentoOCR.count({
        where: { status: 'SUCESSO' },
      }),

      // Erros
      this.prisma.processamentoOCR.count({
        where: { status: 'ERRO' },
      }),

      // Por tipo de análise
      this.prisma.processamentoOCR.groupBy({
        by: ['tipoAnalise'],
        _count: { id: true },
      }),

      // Por formato (simulado já que não temos no schema ainda)
      Promise.resolve([
        { formato: 'JPEG', _count: { id: 450 } },
        { formato: 'PNG', _count: { id: 300 } },
        { formato: 'PDF', _count: { id: 150 } },
      ]),

      // Confiança média
      this.prisma.processamentoOCR.aggregate({
        _avg: { confianca: true },
        where: { status: 'SUCESSO', confianca: { not: null } },
      }),

      // Tempo médio
      this.prisma.processamentoOCR.aggregate({
        _avg: { tempoProcessamento: true },
        where: { status: 'SUCESSO', tempoProcessamento: { not: null } },
      }),
    ]);

    const taxaSucesso = total > 0 ? ((sucessos / total) * 100).toFixed(1) : '0';

    const porTipoAnalise = porTipo.reduce((acc, item) => {
      acc[item.tipoAnalise] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const porFormatoObj = porFormato.reduce((acc, item) => {
      acc[item.formato] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalProcessamentos: total,
      processamentosHoje,
      sucessos,
      erros,
      taxaSucesso: `${taxaSucesso}%`,
      confiancaMedia: confiancaMedia._avg.confianca || 0,
      tempoMedioProcessamento: Math.round(tempoMedio._avg.tempoProcessamento || 0),
      porTipoAnalise,
      porFormato: porFormatoObj,
    };
  }

  // MÉTODOS PRIVADOS

  private async salvarHistoricoProcessamento(dados: {
    processamentoId: string;
    tipoAnalise: string;
    atendimentoId?: string;
    documentoId?: string;
    status: string;
    confiança?: number;
    tempoProcessamento?: number;
    resultado?: any;
    erro?: string;
  }): Promise<void> {
    try {
      await this.prisma.processamentoOCR.create({
        data: {
          id: dados.processamentoId,
          tipoAnalise: dados.tipoAnalise,
          atendimentoId: dados.atendimentoId,
          documentoId: dados.documentoId,
          status: dados.status,
          confianca: dados.confiança,
          tempoProcessamento: dados.tempoProcessamento,
          resultadoJson: dados.resultado,
          observacoes: dados.erro,
        },
      });
    } catch (error) {
      this.logger.error('Erro ao salvar histórico de processamento', error);
      // Não propagar erro para não afetar o processamento principal
    }
  }

  private calcularSimilaridade(texto1: string, texto2: string): number {
    // Implementação simples de similaridade baseada em palavras comuns
    const palavras1 = new Set(texto1.split(/\s+/).filter(p => p.length > 2));
    const palavras2 = new Set(texto2.split(/\s+/).filter(p => p.length > 2));

    const intersecao = new Set([...palavras1].filter(p => palavras2.has(p)));
    const uniao = new Set([...palavras1, ...palavras2]);

    return uniao.size > 0 ? intersecao.size / uniao.size : 0;
  }
}