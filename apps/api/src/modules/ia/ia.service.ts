import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { 
  ProcessarTextoIADto,
  NormalizarExamesDto,
  TestarIADto,
  ConfiguracaoIADto,
  ResultadoAnaliseIADto,
  ResultadoNormalizacaoExamesDto,
  RelatorioIADto,
  TipoAnaliseIA,
  ModeloIA
} from './dto/ia.dto';
import { IAProvider, ConfiguracaoProviderIA } from './providers/ia.provider';
import { ClaudeProvider } from './providers/claude.provider';

@Injectable()
export class IAService {
  private readonly logger = new Logger(IAService.name);
  private provider: IAProvider;
  private readonly providerAtivo: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.providerAtivo = this.configService.get<string>('IA_PROVIDER', 'CLAUDE');
    this.inicializarProvider();
  }

  private inicializarProvider(): void {
    const config = this.obterConfiguracaoProvider();

    switch (this.providerAtivo) {
      case 'CLAUDE':
        this.provider = new ClaudeProvider(config);
        break;
      
      case 'OPENAI':
        // Implementar futuramente
        this.logger.warn('OpenAI não implementado ainda, usando Claude');
        this.provider = new ClaudeProvider(config);
        break;

      case 'AZURE_AI':
        // Implementar futuramente
        this.logger.warn('Azure AI não implementado ainda, usando Claude');
        this.provider = new ClaudeProvider(config);
        break;

      default:
        this.logger.warn(`Provider desconhecido: ${this.providerAtivo}, usando Claude`);
        this.provider = new ClaudeProvider(config);
    }

    this.logger.log(`IA Provider configurado: ${this.provider.getNome()}`);
  }

  private obterConfiguracaoProvider(): ConfiguracaoProviderIA {
    return {
      habilitado: this.configService.get<string>('IA_ENABLED', 'true') === 'true',
      timeout: this.configService.get<number>('IA_TIMEOUT_MS', 60000),
      temperaturaPadrao: this.configService.get<number>('IA_DEFAULT_TEMPERATURE', 0.3),
      maxTokensPadrao: this.configService.get<number>('IA_DEFAULT_MAX_TOKENS', 2000),
      limitePorMinuto: this.configService.get<number>('IA_RATE_LIMIT_PER_MINUTE', 50),
      credenciais: {
        claudeApiKey: this.configService.get('CLAUDE_API_KEY'),
        openaiApiKey: this.configService.get('OPENAI_API_KEY'),
        azureApiKey: this.configService.get('AZURE_AI_API_KEY'),
        azureEndpoint: this.configService.get('AZURE_AI_ENDPOINT'),
      },
    };
  }

  async processarTexto(dto: ProcessarTextoIADto): Promise<ResultadoAnaliseIADto> {
    try {
      this.logger.log(`Iniciando processamento IA - Tipo: ${dto.tipoAnalise}, Modelo: ${dto.modelo || 'padrão'}`);

      // Validar se o serviço está habilitado
      const config = this.obterConfiguracaoProvider();
      if (!config.habilitado) {
        throw new BadRequestException('Serviço de IA está desabilitado');
      }

      // Processar usando o provider
      const resultado = await this.provider.processarTexto({
        texto: dto.texto,
        tipoAnalise: dto.tipoAnalise,
        modelo: dto.modelo || ModeloIA.CLAUDE_SONNET,
        contexto: dto.contexto,
        temperatura: dto.temperatura,
        maxTokens: dto.maxTokens,
        parametros: dto.parametros,
      });

      // Salvar histórico no banco
      await this.salvarHistoricoProcessamento({
        processamentoId: resultado.processamentoId,
        tipoAnalise: dto.tipoAnalise,
        modelo: resultado.modelo,
        atendimentoId: dto.atendimentoId,
        documentoId: dto.documentoId,
        status: 'SUCESSO',
        confianca: resultado.confiancaGeral,
        tempoProcessamento: resultado.tempoProcessamento,
        tokensUtilizados: resultado.tokensUtilizados.total,
        custoEstimado: resultado.metadados.custo_estimado || 0,
        resultado: resultado,
      });

      // Log de sistema
      await this.prisma.logSistema.create({
        data: {
          modulo: 'IA',
          nivel: 'INFO',
          mensagem: 'Processamento IA concluído com sucesso',
          contextoJson: {
            processamento_id: resultado.processamentoId,
            tipo_analise: dto.tipoAnalise,
            modelo: resultado.modelo,
            confianca: resultado.confiancaGeral,
            tempo_ms: resultado.tempoProcessamento,
            tokens_utilizados: resultado.tokensUtilizados.total,
            provider: this.provider.getNome(),
            atendimento_id: dto.atendimentoId,
            documento_id: dto.documentoId,
          },
        },
      });

      return resultado;

    } catch (error) {
      this.logger.error('Erro no processamento IA', error);

      // Salvar erro no histórico
      const processamentoId = `erro_${Date.now()}`;
      await this.salvarHistoricoProcessamento({
        processamentoId,
        tipoAnalise: dto.tipoAnalise,
        modelo: dto.modelo || ModeloIA.CLAUDE_SONNET,
        atendimentoId: dto.atendimentoId,
        documentoId: dto.documentoId,
        status: 'ERRO',
        erro: error.message,
      });

      // Log de erro
      await this.prisma.logSistema.create({
        data: {
          modulo: 'IA',
          nivel: 'ERROR',
          mensagem: 'Falha no processamento IA',
          contextoJson: {
            processamento_id: processamentoId,
            tipo_analise: dto.tipoAnalise,
            modelo: dto.modelo,
            erro: error.message,
            provider: this.provider.getNome(),
            atendimento_id: dto.atendimentoId,
            documento_id: dto.documentoId,
          },
        },
      });

      throw new BadRequestException(`Falha no processamento IA: ${error.message}`);
    }
  }

  async normalizarExames(dto: NormalizarExamesDto): Promise<ResultadoNormalizacaoExamesDto> {
    try {
      this.logger.log(`Normalizando ${dto.exames.length} exames com IA`);

      // Validar entrada
      if (!dto.exames || dto.exames.length === 0) {
        throw new BadRequestException('Lista de exames não pode estar vazia');
      }

      if (dto.exames.length > 50) {
        throw new BadRequestException('Máximo de 50 exames por vez');
      }

      // Construir contexto adicional
      let contextoCompleto = dto.contextoMedico || '';
      
      if (dto.convenioId) {
        const convenio = await this.prisma.convenio.findUnique({
          where: { id: dto.convenioId },
          select: { nome: true, cobertura: true },
        });
        
        if (convenio) {
          contextoCompleto += `\nConvênio: ${convenio.nome}`;
          if (convenio.cobertura) {
            contextoCompleto += `\nCobertura: ${JSON.stringify(convenio.cobertura)}`;
          }
        }
      }

      // Parâmetros específicos para normalização
      const parametrosExtras = {
        incluirSugestoes: dto.incluirSugestoes || false,
        verificarConsistencia: dto.verificarConsistencia !== false,
        convenioId: dto.convenioId,
      };

      // Usar o método específico do provider
      const resultado = await this.provider.normalizarExames(
        dto.exames,
        contextoCompleto,
        parametrosExtras
      );

      // Salvar histórico específico de normalização
      await this.salvarHistoricoProcessamento({
        processamentoId: resultado.processamentoId,
        tipoAnalise: TipoAnaliseIA.NORMALIZACAO_EXAMES,
        modelo: resultado.modelo,
        status: 'SUCESSO',
        confianca: resultado.confiancaGeral,
        tempoProcessamento: resultado.tempoProcessamento,
        tokensUtilizados: resultado.tokensUtilizados.total,
        custoEstimado: resultado.metadados.custo_estimado || 0,
        resultado: resultado,
        observacoes: `Normalizados: ${resultado.estatisticas.normalizados_com_sucesso}/${resultado.estatisticas.total_exames}`,
      });

      // Log específico de normalização
      await this.prisma.logSistema.create({
        data: {
          modulo: 'IA',
          nivel: 'INFO',
          mensagem: 'Normalização de exames concluída',
          contextoJson: {
            processamento_id: resultado.processamentoId,
            total_exames: dto.exames.length,
            normalizados_sucesso: resultado.estatisticas.normalizados_com_sucesso,
            baixa_confianca: resultado.estatisticas.normalizados_com_baixa_confianca,
            nao_reconhecidos: resultado.estatisticas.nao_reconhecidos,
            convenio_id: dto.convenioId,
            incluir_sugestoes: dto.incluirSugestoes,
          },
        },
      });

      return resultado;

    } catch (error) {
      this.logger.error('Erro na normalização de exames', error);
      
      // Log de erro específico
      await this.prisma.logSistema.create({
        data: {
          modulo: 'IA',
          nivel: 'ERROR',
          mensagem: 'Falha na normalização de exames',
          contextoJson: {
            total_exames: dto.exames?.length || 0,
            convenio_id: dto.convenioId,
            erro: error.message,
          },
        },
      });

      throw new BadRequestException(`Falha na normalização de exames: ${error.message}`);
    }
  }

  async testarConexao(dto: TestarIADto): Promise<any> {
    try {
      this.logger.log('Testando conexão IA');

      const modelo = dto.modelo || ModeloIA.CLAUDE_HAIKU; // Usar Haiku para teste (mais barato)
      const resultado = await this.provider.testarConexao(dto.textoTeste, modelo);

      // Se resposta esperada foi fornecida, comparar
      if (dto.respostaEsperada && resultado.sucesso) {
        const respostaObtida = resultado.detalhes.resposta_obtida || '';
        const similaridade = this.calcularSimilaridade(
          dto.respostaEsperada.toLowerCase(),
          respostaObtida.toLowerCase()
        );

        resultado.detalhes.resposta_esperada = dto.respostaEsperada;
        resultado.detalhes.similaridade = `${(similaridade * 100).toFixed(1)}%`;
        resultado.detalhes.teste_validacao = similaridade > 0.7 ? 'APROVADO' : 'REPROVADO';
      }

      // Log do teste
      await this.prisma.logSistema.create({
        data: {
          modulo: 'IA',
          nivel: 'INFO',
          mensagem: 'Teste de conexão IA realizado',
          contextoJson: {
            provider: this.provider.getNome(),
            modelo: modelo,
            sucesso: resultado.sucesso,
            detalhes: resultado.detalhes,
          },
        },
      });

      return resultado;

    } catch (error) {
      this.logger.error('Erro no teste de conexão IA', error);

      return {
        sucesso: false,
        detalhes: {
          erro: error.message,
          provider: this.provider.getNome(),
        },
      };
    }
  }

  async obterConfiguracoes(): Promise<ConfiguracaoIADto> {
    const config = this.obterConfiguracaoProvider();
    
    return {
      provedor: this.provider.getNome(),
      modeloPadrao: ModeloIA.CLAUDE_SONNET,
      habilitado: config.habilitado,
      temperaturaPadrao: config.temperaturaPadrao,
      maxTokensPorRequisicao: config.maxTokensPadrao,
      timeout: config.timeout,
      limitePorMinuto: config.limitePorMinuto,
    };
  }

  async obterHistorico(
    page = 1, 
    limit = 20, 
    tipoAnalise?: string,
    modelo?: string,
    dataInicio?: Date,
    dataFim?: Date
  ): Promise<{ data: any[]; meta: any }> {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (tipoAnalise) {
      where.tipoAnalise = tipoAnalise;
    }
    if (modelo) {
      where.modelo = modelo;
    }
    if (dataInicio && dataFim) {
      where.createdAt = {
        gte: dataInicio,
        lte: dataFim,
      };
    }

    const [processamentos, total] = await Promise.all([
      this.prisma.processamentoIA.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          tipoAnalise: true,
          modelo: true,
          status: true,
          confianca: true,
          tempoProcessamento: true,
          tokensUtilizados: true,
          custoEstimado: true,
          atendimentoId: true,
          documentoId: true,
          observacoes: true,
        },
      }),
      this.prisma.processamentoIA.count({ where }),
    ]);

    return {
      data: processamentos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async obterRelatorio(): Promise<RelatorioIADto> {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    const [
      total,
      processamentosHoje,
      sucessos,
      erros,
      porTipo,
      porModelo,
      agregacoes
    ] = await Promise.all([
      // Total de processamentos
      this.prisma.processamentoIA.count(),

      // Processamentos hoje
      this.prisma.processamentoIA.count({
        where: { createdAt: { gte: hoje } },
      }),

      // Sucessos
      this.prisma.processamentoIA.count({
        where: { status: 'SUCESSO' },
      }),

      // Erros
      this.prisma.processamentoIA.count({
        where: { status: 'ERRO' },
      }),

      // Por tipo de análise
      this.prisma.processamentoIA.groupBy({
        by: ['tipoAnalise'],
        _count: { id: true },
      }),

      // Por modelo
      this.prisma.processamentoIA.groupBy({
        by: ['modelo'],
        _count: { id: true },
      }),

      // Agregações numéricas
      this.prisma.processamentoIA.aggregate({
        _sum: { 
          tokensUtilizados: true,
          custoEstimado: true,
        },
        _avg: { 
          confianca: true,
          tempoProcessamento: true,
        },
        where: { status: 'SUCESSO' },
      }),
    ]);

    const taxaSucesso = total > 0 ? ((sucessos / total) * 100).toFixed(1) : '0';

    const porTipoAnalise = porTipo.reduce((acc, item) => {
      acc[item.tipoAnalise] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const porModeloObj = porModelo.reduce((acc, item) => {
      acc[item.modelo] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalProcessamentos: total,
      processamentosHoje,
      sucessos,
      erros,
      taxaSucesso: `${taxaSucesso}%`,
      tokensTotaisUtilizados: agregacoes._sum.tokensUtilizados || 0,
      custoEstimado: agregacoes._sum.custoEstimado || 0,
      tempoMedioProcessamento: Math.round(agregacoes._avg.tempoProcessamento || 0),
      confiancaMedia: Number((agregacoes._avg.confianca || 0).toFixed(3)),
      porTipoAnalise,
      porModelo: porModeloObj,
    };
  }

  async reprocessarFalhados(): Promise<void> {
    const processamentosFalhados = await this.prisma.processamentoIA.findMany({
      where: {
        status: 'ERRO',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24h
        },
      },
      take: 10, // Limitar para não sobrecarregar
      include: {
        resultadoJson: true,
      },
    });

    this.logger.log(`Reprocessando ${processamentosFalhados.length} processamentos falhados`);

    for (const processamento of processamentosFalhados) {
      try {
        // Aqui implementaríamos a lógica de reprocessamento
        // Por enquanto, apenas marcar como tentativa de reprocessamento
        await this.prisma.processamentoIA.update({
          where: { id: processamento.id },
          data: {
            observacoes: 'Tentativa de reprocessamento automático',
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.error(`Erro ao reprocessar ${processamento.id}`, error);
      }
    }
  }

  // MÉTODOS PRIVADOS

  private async salvarHistoricoProcessamento(dados: {
    processamentoId: string;
    tipoAnalise: TipoAnaliseIA;
    modelo: ModeloIA;
    atendimentoId?: string;
    documentoId?: string;
    status: string;
    confianca?: number;
    tempoProcessamento?: number;
    tokensUtilizados?: number;
    custoEstimado?: number;
    resultado?: any;
    erro?: string;
    observacoes?: string;
  }): Promise<void> {
    try {
      await this.prisma.processamentoIA.create({
        data: {
          id: dados.processamentoId,
          tipoAnalise: dados.tipoAnalise,
          modelo: dados.modelo,
          atendimentoId: dados.atendimentoId,
          documentoId: dados.documentoId,
          status: dados.status,
          confianca: dados.confianca,
          tempoProcessamento: dados.tempoProcessamento,
          tokensUtilizados: dados.tokensUtilizados,
          custoEstimado: dados.custoEstimado,
          resultadoJson: dados.resultado,
          observacoes: dados.erro || dados.observacoes,
        },
      });
    } catch (error) {
      this.logger.error('Erro ao salvar histórico de processamento IA', error);
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