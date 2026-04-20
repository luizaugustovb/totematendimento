import { Injectable, Logger } from '@nestjs/common';
import { Anthropic } from '@anthropic-ai/sdk';
import { IAProvider, ParametrosProcessamentoIA, ConfiguracaoProviderIA } from './ia.provider';
import { 
  ResultadoAnaliseIADto, 
  TipoAnaliseIA, 
  ModeloIA,
  ExameNormalizadoDto,
  SugestaoExameDto,
  ResultadoNormalizacaoExamesDto
} from '../dto/ia.dto';

@Injectable()
export class ClaudeProvider extends IAProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  private client: Anthropic;

  // Mapeamento de modelos para IDs do Claude
  private readonly modeloIds = {
    [ModeloIA.CLAUDE_SONNET]: 'claude-3-5-sonnet-20241022',
    [ModeloIA.CLAUDE_HAIKU]: 'claude-3-haiku-20240307',
  };

  constructor(config: ConfiguracaoProviderIA) {
    super(config);
    
    if (this.config.habilitado) {
      this.inicializarClient();
    }
  }

  private inicializarClient(): void {
    try {
      const apiKey = this.config.credenciais?.claudeApiKey;
      
      if (!apiKey) {
        throw new Error('API Key do Claude não configurada');
      }

      this.client = new Anthropic({
        apiKey: apiKey,
        timeout: this.config.timeout,
      });

      this.logger.log('Claude Client inicializado com sucesso');
    } catch (error) {
      this.logger.error('Erro ao inicializar Claude Client', error);
      throw new Error(`Falha na inicialização do Claude: ${error.message}`);
    }
  }

  getNome(): string {
    return 'Claude (Anthropic)';
  }

  getVersao(): string {
    return '5.0.0'; // Versão da biblioteca
  }

  getModelosSuportados(): ModeloIA[] {
    return [ModeloIA.CLAUDE_SONNET, ModeloIA.CLAUDE_HAIKU];
  }

  async processarTexto(parametros: ParametrosProcessamentoIA): Promise<ResultadoAnaliseIADto> {
    if (!this.config.habilitado) {
      throw new Error('Claude Provider está desabilitado');
    }

    const inicioProcessamento = Date.now();
    const processamentoId = this.gerarProcessamentoId(parametros.tipoAnalise, parametros.modelo);

    try {
      // Validações
      this.validarModelo(parametros.modelo);
      
      const configuracoes = {
        ...this.aplicarConfiguracoesTipo(parametros.tipoAnalise),
        ...parametros.parametros,
      };

      // Gerar prompt específico
      const prompt = this.gerarPrompt(
        parametros.tipoAnalise,
        parametros.texto,
        parametros.contexto,
        configuracoes
      );

      const temperatura = parametros.temperatura ?? configuracoes.temperatura;
      const maxTokens = parametros.maxTokens ?? configuracoes.maxTokens;

      this.logger.log(`Processando com Claude - Modelo: ${parametros.modelo}, Tipo: ${parametros.tipoAnalise}`);

      // Chamar API do Claude
      const response = await this.client.messages.create({
        model: this.modeloIds[parametros.modelo],
        max_tokens: maxTokens,
        temperature: temperatura,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const conteudoResposta = response.content[0];
      
      if (conteudoResposta.type !== 'text') {
        throw new Error('Resposta em formato não suportado');
      }

      const resultado = conteudoResposta.text;
      
      // Calcular tokens utilizados
      const tokensUtilizados = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      };

      // Calcular custo estimado
      const custoEstimado = this.calcularCustoEstimado(
        tokensUtilizados.input,
        tokensUtilizados.output,
        parametros.modelo
      );

      const tempoProcessamento = Date.now() - inicioProcessamento;

      // Tentar extrair dados estruturados se for JSON
      let dadosEstruturados = null;
      let sugestoes: string[] = [];
      let alertas: string[] = [];

      try {
        if (resultado.includes('{') && resultado.includes('}')) {
          // Extrair JSON da resposta
          const jsonMatch = resultado.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            dadosEstruturados = JSON.parse(jsonMatch[0]);
            
            // Extrair sugestões e alertas se existirem
            if (dadosEstruturados.sugestoes) {
              sugestoes = Array.isArray(dadosEstruturados.sugestoes) 
                ? dadosEstruturados.sugestoes 
                : [dadosEstruturados.sugestoes];
            }
            
            if (dadosEstruturados.alertas) {
              alertas = Array.isArray(dadosEstruturados.alertas)
                ? dadosEstruturados.alertas
                : [dadosEstruturados.alertas];
            }
          }
        }
      } catch (error) {
        this.logger.warn('Erro ao fazer parse do JSON na resposta da IA', error);
        // Não falha o processamento, apenas não extrai dados estruturados
      }

      // Calcular confiança geral baseada em heurísticas
      const confiancaGeral = this.calcularConfiancaGeral(
        resultado,
        dadosEstruturados,
        parametros.tipoAnalise
      );

      const resultadoFinal: ResultadoAnaliseIADto = {
        tipoAnalise: parametros.tipoAnalise,
        modelo: parametros.modelo,
        resultado,
        confiancaGeral,
        dadosEstruturados,
        sugestoes: sugestoes.length > 0 ? sugestoes : undefined,
        alertas: alertas.length > 0 ? alertas : undefined,
        tempoProcessamento,
        tokensUtilizados,
        processamentoId,
        metadados: {
          provedor: this.getNome(),
          versao: this.getVersao(),
          modelo_id: this.modeloIds[parametros.modelo],
          temperatura,
          max_tokens: maxTokens,
          custo_estimado: custoEstimado,
          configuracoes_aplicadas: configuracoes,
        },
      };

      this.logger.log(
        `Processamento Claude concluído - ID: ${processamentoId}, ` +
        `Tokens: ${tokensUtilizados.total}, Tempo: ${tempoProcessamento}ms, ` +
        `Custo: $${custoEstimado.toFixed(4)}`
      );

      return resultadoFinal;

    } catch (error) {
      const tempoProcessamento = Date.now() - inicioProcessamento;
      
      this.logger.error(`Erro no processamento Claude - ID: ${processamentoId}`, error);
      
      throw new Error(`Falha no processamento Claude: ${error.message} (Tempo: ${tempoProcessamento}ms)`);
    }
  }

  async testarConexao(textoTeste?: string, modelo?: ModeloIA): Promise<{ sucesso: boolean; detalhes: any }> {
    try {
      if (!this.config.habilitado) {
        return {
          sucesso: false,
          detalhes: { erro: 'Provider desabilitado' }
        };
      }

      const modeloTeste = modelo || ModeloIA.CLAUDE_HAIKU; // Usar Haiku para teste (mais barato)
      const textoParaTeste = textoTeste || 'Responda apenas: "Conexão OK"';
      
      const resultado = await this.processarTexto({
        texto: textoParaTeste,
        tipoAnalise: TipoAnaliseIA.RESUMO_CONTEUDO,
        modelo: modeloTeste,
        temperatura: 0.1,
        maxTokens: 50,
      });

      return {
        sucesso: true,
        detalhes: {
          provedor: this.getNome(),
          versao: this.getVersao(),
          modelo_testado: modeloTeste,
          resposta_obtida: resultado.resultado.substring(0, 200),
          tempo_processamento: resultado.tempoProcessamento,
          tokens_utilizados: resultado.tokensUtilizados.total,
          custo_teste: resultado.metadados.custo_estimado,
        }
      };

    } catch (error) {
      return {
        sucesso: false,
        detalhes: {
          erro: error.message,
          provedor: this.getNome(),
        }
      };
    }
  }

  async normalizarExames(
    exames: string[], 
    contexto?: string,
    parametrosExtras?: Record<string, any>
  ): Promise<ResultadoNormalizacaoExamesDto> {
    
    const textoExames = exames.join('\n- ');
    const contextoCompleto = contexto ? `Contexto: ${contexto}` : '';

    const resultado = await this.processarTexto({
      texto: `Exames a normalizar:\n- ${textoExames}`,
      tipoAnalise: TipoAnaliseIA.NORMALIZACAO_EXAMES,
      modelo: ModeloIA.CLAUDE_SONNET, // Usar Sonnet para maior precisão
      contexto: contextoCompleto,
      temperatura: 0.1, // Baixa temperatura para consistência
      maxTokens: 3000,
      parametros: parametrosExtras,
    });

    // Processar resposta específica para normalização
    const dadosNormalizacao = resultado.dadosEstruturados;
    
    if (!dadosNormalizacao?.exames_normalizados) {
      throw new Error('Resposta da IA não contém dados de normalização válidos');
    }

    // Converter para formato esperado
    const examesNormalizados: ExameNormalizadoDto[] = dadosNormalizacao.exames_normalizados.map((exame: any) => ({
      exameOriginal: exame.exame_original || exame.original || '',
      exameNormalizado: exame.exame_normalizado || exame.normalizado || '',
      codigoExame: exame.codigo_exame || exame.codigo || '',
      confianca: exame.confianca || 0.8,
      categoria: exame.categoria || 'Não classificado',
      sinonimos: exame.sinonimos || [],
      observacoes: exame.observacoes || exame.observacao || '',
    }));

    // Processar sugestões de exames se existirem
    const sugestoesExames: SugestaoExameDto[] = [];
    if (dadosNormalizacao.sugestoes_exames || dadosNormalizacao.sugestoes) {
      const sugestoesDados = dadosNormalizacao.sugestoes_exames || dadosNormalizacao.sugestoes;
      sugestoesDados.forEach((sugestao: any) => {
        if (typeof sugestao === 'object') {
          sugestoesExames.push({
            nomeExame: sugestao.nome || sugestao.exame || '',
            justificativa: sugestao.justificativa || sugestao.motivo || '',
            prioridade: sugestao.prioridade || 5,
            categoria: sugestao.categoria || 'Complementar',
          });
        }
      });
    }

    // Calcular estatísticas
    const totalExames = exames.length;
    const normalizadosComSucesso = examesNormalizados.filter(e => e.confianca >= 0.7).length;
    const normalizadosComBaixaConfianca = examesNormalizados.filter(e => e.confianca < 0.7 && e.confianca > 0.3).length;
    const naoReconhecidos = examesNormalizados.filter(e => e.confianca <= 0.3).length;

    return {
      ...resultado,
      examesNormalizados,
      sugestoesExames: sugestoesExames.length > 0 ? sugestoesExames : undefined,
      alertasConsistencia: dadosNormalizacao.alertas || [],
      estatisticas: {
        total_exames: totalExames,
        normalizados_com_sucesso: normalizadosComSucesso,
        normalizados_com_baixa_confianca: normalizadosComBaixaConfianca,
        nao_reconhecidos: naoReconhecidos,
      },
    };
  }

  // MÉTODOS PRIVADOS

  private calcularConfiancaGeral(
    resultado: string,
    dadosEstruturados: any,
    tipoAnalise: TipoAnaliseIA
  ): number {
    let confiancaBase = 0.7; // Base para respostas válidas

    // Se tem dados estruturados válidos, aumentar confiança
    if (dadosEstruturados) {
      confiancaBase += 0.15;
      
      // Se os dados têm campos de confiança próprios, usar a média
      if (dadosEstruturados.confianca_geral) {
        confiancaBase = Math.max(confiancaBase, dadosEstruturados.confianca_geral);
      }
    }

    // Penalizar respostas muito curtas
    if (resultado.length < 50) {
      confiancaBase *= 0.8;
    }

    // Beneficiar respostas com estrutura clara
    if (resultado.includes('{') && resultado.includes('}')) {
      confiancaBase += 0.1;
    }

    // Ajustes por tipo de análise
    switch (tipoAnalise) {
      case TipoAnaliseIA.NORMALIZACAO_EXAMES:
        // É crítico, então ser mais conservador
        confiancaBase *= 0.9;
        break;
      
      case TipoAnaliseIA.RESUMO_CONTEUDO:
        // Menos crítico, pode ser mais liberal
        confiancaBase *= 1.1;
        break;
    }

    return Math.min(Math.max(confiancaBase, 0), 1);
  }
}