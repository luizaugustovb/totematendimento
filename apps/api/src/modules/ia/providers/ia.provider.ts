import { TipoAnaliseIA, ModeloIA, ResultadoAnaliseIADto } from '../dto/ia.dto';

export interface ConfiguracaoProviderIA {
  habilitado: boolean;
  timeout: number;
  temperaturaPadrao: number;
  maxTokensPadrao: number;
  limitePorMinuto: number;
  credenciais: Record<string, any>;
}

export interface ParametrosProcessamentoIA {
  texto: string;
  tipoAnalise: TipoAnaliseIA;
  modelo: ModeloIA;
  contexto?: string;
  temperatura?: number;
  maxTokens?: number;
  parametros?: Record<string, any>;
}

export interface ParametrosModelo {
  temperatura: number;
  maxTokens: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export abstract class IAProvider {
  protected config: ConfiguracaoProviderIA;
  
  constructor(config: ConfiguracaoProviderIA) {
    this.config = config;
  }

  abstract getNome(): string;
  abstract getVersao(): string;
  abstract getModelosSuportados(): ModeloIA[];
  
  /**
   * Processa texto usando IA para análise específica
   */
  abstract processarTexto(parametros: ParametrosProcessamentoIA): Promise<ResultadoAnaliseIADto>;
  
  /**
   * Testa a conexão e funcionamento do provedor
   */
  abstract testarConexao(textoTeste?: string, modelo?: ModeloIA): Promise<{ sucesso: boolean; detalhes: any }>;
  
  /**
   * Normaliza lista de exames usando IA
   */
  abstract normalizarExames(
    exames: string[], 
    contexto?: string,
    parametrosExtras?: Record<string, any>
  ): Promise<any>;

  /**
   * Valida se o modelo é suportado por este provider
   */
  protected validarModelo(modelo: ModeloIA): void {
    const modelosSuportados = this.getModelosSuportados();
    if (!modelosSuportados.includes(modelo)) {
      throw new Error(`Modelo ${modelo} não é suportado por ${this.getNome()}`);
    }
  }

  /**
   * Aplica configurações específicas do tipo de análise
   */
  protected aplicarConfiguracoesTipo(tipoAnalise: TipoAnaliseIA): Record<string, any> {
    const configuracoesPadrao = {
      temperatura: this.config.temperaturaPadrao,
      maxTokens: this.config.maxTokensPadrao,
    };

    switch (tipoAnalise) {
      case TipoAnaliseIA.NORMALIZACAO_EXAMES:
        return {
          ...configuracoesPadrao,
          temperatura: 0.1, // Baixa criatividade para normalização
          maxTokens: 2000,
          incluirConfidencia: true,
          formatoSaida: 'json',
          incluirSinonimos: true,
        };

      case TipoAnaliseIA.INTERPRETACAO_DOCUMENTO:
        return {
          ...configuracoesPadrao,
          temperatura: 0.3,
          maxTokens: 3000,
          extrairCamposEstruturados: true,
          identificarTipoDocumento: true,
        };

      case TipoAnaliseIA.EXTRACAO_DADOS_ESTRUTURADOS:
        return {
          ...configuracoesPadrao,
          temperatura: 0.1,
          maxTokens: 2500,
          formatoSaida: 'json',
          validarEstrutura: true,
        };

      case TipoAnaliseIA.CLASSIFICACAO_DOCUMENTO:
        return {
          ...configuracoesPadrao,
          temperatura: 0.2,
          maxTokens: 1000,
          incluirConfidencia: true,
          categoriasPredefinidas: true,
        };

      case TipoAnaliseIA.VALIDACAO_CONSISTENCIA:
        return {
          ...configuracoesPadrao,
          temperatura: 0.2,
          maxTokens: 1500,
          detectarInconsistencias: true,
          sugerirCorrecoes: true,
        };

      case TipoAnaliseIA.SUGESTAO_CORRECAO:
        return {
          ...configuracoesPadrao,
          temperatura: 0.5,
          maxTokens: 2000,
          incluirAlternativas: true,
          explicarSugestoes: true,
        };

      case TipoAnaliseIA.RESUMO_CONTEUDO:
        return {
          ...configuracoesPadrao,
          temperatura: 0.4,
          maxTokens: 1500,
          manterPontosChave: true,
          formatoConciso: true,
        };

      default:
        return configuracoesPadrao;
    }
  }

  /**
   * Gera prompt específico para cada tipo de análise
   */
  protected gerarPrompt(tipoAnalise: TipoAnaliseIA, texto: string, contexto?: string, parametros?: Record<string, any>): string {
    const baseConfig = this.aplicarConfiguracoesTipo(tipoAnalise);
    const contextoTexto = contexto ? `\n\nContexto adicional: ${contexto}` : '';

    switch (tipoAnalise) {
      case TipoAnaliseIA.NORMALIZACAO_EXAMES:
        return this.gerarPromptNormalizacaoExames(texto, contextoTexto, parametros);

      case TipoAnaliseIA.INTERPRETACAO_DOCUMENTO:
        return this.gerarPromptInterpretacaoDocumento(texto, contextoTexto, parametros);

      case TipoAnaliseIA.EXTRACAO_DADOS_ESTRUTURADOS:
        return this.gerarPromptExtracaoDados(texto, contextoTexto, parametros);

      case TipoAnaliseIA.CLASSIFICACAO_DOCUMENTO:
        return this.gerarPromptClassificacaoDocumento(texto, contextoTexto, parametros);

      case TipoAnaliseIA.VALIDACAO_CONSISTENCIA:
        return this.gerarPromptValidacaoConsistencia(texto, contextoTexto, parametros);

      case TipoAnaliseIA.SUGESTAO_CORRECAO:
        return this.gerarPromptSugestaoCorrecao(texto, contextoTexto, parametros);

      case TipoAnaliseIA.RESUMO_CONTEUDO:
        return this.gerarPromptResumoConteudo(texto, contextoTexto, parametros);

      default:
        return `Analise o seguinte texto: ${texto}${contextoTexto}`;
    }
  }

  /**
   * Gera prompt específico para normalização de exames
   */
  protected gerarPromptNormalizacaoExames(texto: string, contexto: string, parametros?: Record<string, any>): string {
    return `
Você é um especialista em normalização de exames laboratoriais e deve analisar a seguinte lista de exames e normalizá-los seguindo estas diretrizes:

1. Para cada exame mencionado, identifique:
   - Nome normalizado padrão
   - Possíveis sinônimos conhecidos
   - Categoria (Bioquímica, Hematologia, Imunologia, etc.)
   - Código interno se reconhecido
   - Nível de confiança na normalização (0-1)

2. Formato de resposta JSON:
{
  "exames_normalizados": [
    {
      "exame_original": "texto original",
      "exame_normalizado": "nome padrão",
      "codigo_exame": "código se conhecido",
      "categoria": "categoria do exame",
      "confianca": 0.95,
      "sinonimos": ["sinônimo1", "sinônimo2"],
      "observacoes": "observações relevantes"
    }
  ],
  "alertas": ["alertas sobre exames não reconhecidos"],
  "sugestoes": ["sugestões de exames relacionados"]
}

Lista de exames para normalizar:
${texto}

${contexto}

Seja preciso e use nomenclatura médica padrão brasileira.`;
  }

  /**
   * Gera prompt para interpretação de documentos médicos
   */
  protected gerarPromptInterpretacaoDocumento(texto: string, contexto: string, parametros?: Record<string, any>): string {
    return `
Você é um especialista em análise de documentos médicos. Analise o texto fornecido e extraia as informações mais relevantes:

1. Identifique o tipo de documento (receita, pedido de exame, atestado, etc.)
2. Extraia informações estruturadas como:
   - Dados do paciente (nome, idade, etc.)
   - Dados do médico (nome, CRM, especialidade)
   - Conteúdo principal (medicamentos, exames, diagnósticos)
   - Datas relevantes
   - Observações importantes

3. Forneça interpretação do conteúdo médico de forma clara
4. Identifique possíveis inconsistências ou alertas

Documento para análise:
${texto}

${contexto}

Responda de forma estruturada e detalhada.`;
  }

  /**
   * Gera prompt para extração de dados estruturados
   */
  protected gerarPromptExtracaoDados(texto: string, contexto: string, parametros?: Record<string, any>): string {
    return `
Extraia dados estruturados do seguinte texto médico em formato JSON bem organizado:

Priorize a extração de:
- Nomes de pessoas (pacientes, médicos)
- Códigos e números (CRM, carteira do convênio, etc.)
- Datas e horários
- Valores numéricos (resultados de exames, doses)
- Medicamentos e dosagens
- Exames e procedimentos

Formato JSON de saída:
{
  "dados_extraidos": {
    "pessoas": [],
    "codigos": [],
    "datas": [],
    "valores": [],
    "medicamentos": [],
    "exames": []
  },
  "confianca_geral": 0.95,
  "observacoes": []
}

Texto para processar:
${texto}

${contexto}`;
  }

  /**
   * Gera prompt para classificação de documentos
   */
  protected gerarPromptClassificacaoDocumento(texto: string, contexto: string, parametros?: Record<string, any>): string {
    return `
Classifique o tipo de documento médico baseado no conteúdo fornecido:

Categorias possíveis:
- RECEITA_MEDICA
- PEDIDO_EXAME  
- ATESTADO_MEDICO
- LAUDO_EXAME
- CARTEIRA_CONVENIO
- DOCUMENTO_IDENTIFICACAO
- RELATORIO_MEDICO
- OUTROS

Responda em JSON:
{
  "tipo_documento": "categoria identificada",
  "confianca": 0.95,
  "indicadores": ["características que levaram à classificação"],
  "observacoes": "detalhes adicionais"
}

Documento:
${texto}

${contexto}`;
  }

  /**
   * Gera prompt para validação de consistência
   */
  protected gerarPromptValidacaoConsistencia(texto: string, contexto: string, parametros?: Record<string, any>): string {
    return `
Analise a consistência das informações no texto médico fornecido:

Verifique:
1. Consistência entre dados do paciente
2. Coerência entre diagnóstico e medicamentos/exames
3. Dosagens apropriadas para medicamentos
4. Datas lógicas e sequenciais
5. Informações médicas contraditórias

Formato de resposta:
{
  "consistencia_geral": "ALTA/MEDIA/BAIXA",
  "inconsistencias_encontradas": [],
  "alertas": [],
  "sugestoes_correcao": [],
  "score_consistencia": 0.85
}

Texto para validar:
${texto}

${contexto}`;
  }

  /**
   * Gera prompt para sugestão de correções
   */
  protected gerarPromptSugestaoCorrecao(texto: string, contexto: string, parametros?: Record<string, any>): string {
    return `
Analise o texto médico e sugira correções ou melhorias:

Foque em:
- Ortografia de termos médicos
- Clareza das informações
- Completude dos dados
- Padronização de nomenclaturas
- Estruturação do conteúdo

Resposta estruturada:
{
  "sugestoes": [
    {
      "tipo": "ORTOGRAFIA/CLAREZA/COMPLETUDE/PADRONIZACAO",
      "problema": "descrição do problema",
      "sugestao": "texto corrigido sugerido",
      "justificativa": "motivo da sugestão"
    }
  ],
  "texto_corrigido": "versão melhorada do texto completo"
}

Texto original:
${texto}

${contexto}`;
  }

  /**
   * Gera prompt para resumo de conteúdo
   */
  protected gerarPromptResumoConteudo(texto: string, contexto: string, parametros?: Record<string, any>): string {
    return `
Crie um resumo conciso e informativo do conteúdo médico:

Inclua:
- Pontos principais do documento
- Informações críticas de saúde
- Orientações importantes
- Próximos passos se mencionados

Mantenha linguagem clara e técnica adequada:

{
  "resumo_executivo": "resumo em 2-3 frases",
  "pontos_principais": [],
  "informacoes_criticas": [],
  "proximos_passos": [],
  "observacoes": "contexto adicional relevante"
}

Conteúdo para resumir:
${texto}

${contexto}`;
  }

  /**
   * Gera ID único para o processamento
   */
  protected gerarProcessamentoId(tipoAnalise: TipoAnaliseIA, modelo: ModeloIA): string {
    const timestamp = Date.now();
    const prefixo = tipoAnalise.toLowerCase().replace('_', '');
    const modeloSufixo = modelo.toLowerCase().replace('_', '');
    const aleatorio = Math.random().toString(36).substring(2, 8);
    return `${prefixo}_${modeloSufixo}_${timestamp}_${aleatorio}`;
  }

  /**
   * Calcula custo estimado baseado nos tokens utilizados
   */
  protected calcularCustoEstimado(tokensInput: number, tokensOutput: number, modelo: ModeloIA): number {
    // Preços aproximados por 1k tokens (valores podem variar)
    const precos = {
      [ModeloIA.CLAUDE_SONNET]: { input: 0.003, output: 0.015 },
      [ModeloIA.CLAUDE_HAIKU]: { input: 0.00025, output: 0.00125 },
      [ModeloIA.GPT4]: { input: 0.03, output: 0.06 },
      [ModeloIA.GPT35_TURBO]: { input: 0.0015, output: 0.002 },
    };

    const preco = precos[modelo] || precos[ModeloIA.CLAUDE_SONNET];
    return ((tokensInput / 1000) * preco.input) + ((tokensOutput / 1000) * preco.output);
  }
}