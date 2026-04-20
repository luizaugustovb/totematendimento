import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsBoolean, IsObject, IsNumber, ValidateNested, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum TipoAnaliseIA {
  NORMALIZACAO_EXAMES = 'NORMALIZACAO_EXAMES',
  INTERPRETACAO_DOCUMENTO = 'INTERPRETACAO_DOCUMENTO',
  EXTRACAO_DADOS_ESTRUTURADOS = 'EXTRACAO_DADOS_ESTRUTURADOS',
  CLASSIFICACAO_DOCUMENTO = 'CLASSIFICACAO_DOCUMENTO',
  VALIDACAO_CONSISTENCIA = 'VALIDACAO_CONSISTENCIA',
  SUGESTAO_CORRECAO = 'SUGESTAO_CORRECAO',
  RESUMO_CONTEUDO = 'RESUMO_CONTEUDO',
}

export enum ModeloIA {
  CLAUDE_SONNET = 'CLAUDE_SONNET',
  CLAUDE_HAIKU = 'CLAUDE_HAIKU',
  GPT4 = 'GPT4',
  GPT35_TURBO = 'GPT35_TURBO',
}

export class ProcessarTextoIADto {
  @ApiProperty({ 
    description: 'Texto a ser processado pela IA',
    example: 'Exame: Glicose em jejum\nValor: 95 mg/dL\nReferência: 70-100 mg/dL' 
  })
  @IsString()
  @IsNotEmpty()
  texto: string;

  @ApiProperty({ 
    enum: TipoAnaliseIA,
    description: 'Tipo de análise de IA a ser realizada',
    example: TipoAnaliseIA.NORMALIZACAO_EXAMES 
  })
  @IsEnum(TipoAnaliseIA)
  tipoAnalise: TipoAnaliseIA;

  @ApiPropertyOptional({ 
    description: 'Contexto adicional para a análise',
    example: 'Paciente: João Silva, 45 anos, diabético' 
  })
  @IsString()
  @IsOptional()
  contexto?: string;

  @ApiPropertyOptional({ 
    description: 'ID do atendimento relacionado',
    example: 'uuid-atendimento' 
  })
  @IsString()
  @IsOptional()
  atendimentoId?: string;

  @ApiPropertyOptional({ 
    description: 'ID do documento relacionado',
    example: 'uuid-documento' 
  })
  @IsString()
  @IsOptional()
  documentoId?: string;

  @ApiPropertyOptional({ 
    enum: ModeloIA,
    description: 'Modelo de IA a ser utilizado (padrão: CLAUDE_SONNET)',
    example: ModeloIA.CLAUDE_SONNET 
  })
  @IsEnum(ModeloIA)
  @IsOptional()
  modelo?: ModeloIA;

  @ApiPropertyOptional({ 
    description: 'Parâmetros específicos para o tipo de análise',
    example: { incluirSugestoes: true, formatoSaida: 'json' },
    type: 'object' 
  })
  @IsObject()
  @IsOptional()
  parametros?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: 'Temperatura para criatividade da IA (0.0 = determinístico, 1.0 = criativo)',
    example: 0.3,
    minimum: 0,
    maximum: 1 
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperatura?: number;

  @ApiPropertyOptional({ 
    description: 'Limite máximo de tokens na resposta',
    example: 1000,
    minimum: 10,
    maximum: 4000 
  })
  @IsNumber()
  @Min(10)
  @Max(4000)
  @IsOptional()
  maxTokens?: number;
}

export class NormalizarExamesDto {
  @ApiProperty({ 
    description: 'Lista de exames a serem normalizados',
    example: ['glicose jejum', 'hemograma completo', 'hb glicosilada'],
    type: [String] 
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  exames: string[];

  @ApiPropertyOptional({ 
    description: 'Contexto médico adicional',
    example: 'check-up de rotina para paciente diabético' 
  })
  @IsString()
  @IsOptional()
  contextoMedico?: string;

  @ApiPropertyOptional({ 
    description: 'ID do convênio para aplicar regras específicas',
    example: 'uuid-convenio' 
  })
  @IsString()
  @IsOptional()
  convenioId?: string;

  @ApiPropertyOptional({ 
    description: 'Incluir sugestões de exames relacionados',
    example: true,
    default: false 
  })
  @IsBoolean()
  @IsOptional()
  incluirSugestoes?: boolean;

  @ApiPropertyOptional({ 
    description: 'Verificar consistência entre os exames solicitados',
    example: true,
    default: true 
  })
  @IsBoolean()
  @IsOptional()
  verificarConsistencia?: boolean;
}

export class ExameNormalizadoDto {
  @ApiProperty({ 
    description: 'Texto original do exame',
    example: 'glicose jejum' 
  })
  exameOriginal: string;

  @ApiProperty({ 
    description: 'Nome normalizado do exame',
    example: 'Glicose' 
  })
  exameNormalizado: string;

  @ApiProperty({ 
    description: 'Código do exame no sistema',
    example: 'GLIC001' 
  })
  codigoExame: string;

  @ApiProperty({ 
    description: 'Nível de confiança da normalização (0-1)',
    example: 0.95 
  })
  confianca: number;

  @ApiProperty({ 
    description: 'Categoria do exame',
    example: 'Bioquímica' 
  })
  categoria: string;

  @ApiPropertyOptional({ 
    description: 'Sinônimos identificados' 
  })
  sinonimos?: string[];

  @ApiPropertyOptional({ 
    description: 'Observações sobre a normalização' 
  })
  observacoes?: string;
}

export class SugestaoExameDto {
  @ApiProperty({ 
    description: 'Nome do exame sugerido',
    example: 'Hemoglobina Glicada' 
  })
  nomeExame: string;

  @ApiProperty({ 
    description: 'Justificativa da sugestão',
    example: 'Complementa avaliação glicêmica em diabéticos' 
  })
  justificativa: string;

  @ApiProperty({ 
    description: 'Prioridade da sugestão (1-10)',
    example: 8 
  })
  prioridade: number;

  @ApiProperty({ 
    description: 'Categoria do exame sugerido',
    example: 'Bioquímica' 
  })
  categoria: string;
}

export class ResultadoAnaliseIADto {
  @ApiProperty({ 
    description: 'Tipo de análise realizada',
    enum: TipoAnaliseIA 
  })
  tipoAnalise: TipoAnaliseIA;

  @ApiProperty({ 
    description: 'Modelo de IA utilizado',
    enum: ModeloIA 
  })
  modelo: ModeloIA;

  @ApiProperty({ 
    description: 'Resultado principal da análise',
    example: 'Análise concluída com sucesso' 
  })
  resultado: string;

  @ApiProperty({ 
    description: 'Confiança geral da análise (0-1)',
    example: 0.92 
  })
  confiancaGeral: number;

  @ApiPropertyOptional({ 
    description: 'Dados estruturados extraídos',
    example: { exames_encontrados: 3, exames_normalizados: 3 } 
  })
  dadosEstruturados?: any;

  @ApiPropertyOptional({ 
    description: 'Sugestões ou recomendações da IA' 
  })
  sugestoes?: string[];

  @ApiPropertyOptional({ 
    description: 'Alertas ou advertências identificadas' 
  })
  alertas?: string[];

  @ApiProperty({ 
    description: 'Tempo de processamento (ms)',
    example: 2500 
  })
  tempoProcessamento: number;

  @ApiProperty({ 
    description: 'Tokens utilizados na análise',
    example: { input: 150, output: 350, total: 500 } 
  })
  tokensUtilizados: {
    input: number;
    output: number;
    total: number;
  };

  @ApiProperty({ 
    description: 'ID do processamento para referência',
    example: 'ia_12345_20240126' 
  })
  processamentoId: string;

  @ApiProperty({ 
    description: 'Metadados do processamento',
    example: { 
      temperatura: 0.3, 
      max_tokens: 1000,
      provider: 'Claude' 
    } 
  })
  metadados: Record<string, any>;
}

export class ResultadoNormalizacaoExamesDto extends ResultadoAnaliseIADto {
  @ApiProperty({ 
    description: 'Exames processados e normalizados',
    type: [ExameNormalizadoDto] 
  })
  examesNormalizados: ExameNormalizadoDto[];

  @ApiPropertyOptional({ 
    description: 'Sugestões de exames adicionais',
    type: [SugestaoExameDto] 
  })
  sugestoesExames?: SugestaoExameDto[];

  @ApiPropertyOptional({ 
    description: 'Alertas de consistência identificados' 
  })
  alertasConsistencia?: string[];

  @ApiProperty({ 
    description: 'Estatísticas do processamento',
    example: {
      total_exames: 3,
      normalizados_com_sucesso: 3,
      normalizados_com_baixa_confianca: 0,
      nao_reconhecidos: 0
    } 
  })
  estatisticas: {
    total_exames: number;
    normalizados_com_sucesso: number;
    normalizados_com_baixa_confianca: number;
    nao_reconhecidos: number;
  };
}

export class TestarIADto {
  @ApiProperty({ 
    description: 'Texto de teste para a IA',
    example: 'Teste de conexão com IA' 
  })
  @IsString()
  @IsNotEmpty()
  textoTeste: string;

  @ApiPropertyOptional({ 
    enum: ModeloIA,
    description: 'Modelo a ser testado',
    example: ModeloIA.CLAUDE_SONNET 
  })
  @IsEnum(ModeloIA)
  @IsOptional()
  modelo?: ModeloIA;

  @ApiPropertyOptional({ 
    description: 'Resposta esperada para validação',
    example: 'Resposta esperada do teste' 
  })
  @IsString()
  @IsOptional()
  respostaEsperada?: string;
}

export class ConfiguracaoIADto {
  @ApiProperty({ 
    description: 'Provedor de IA configurado',
    example: 'Claude (Anthropic)' 
  })
  provedor: string;

  @ApiProperty({ 
    description: 'Modelo padrão utilizado',
    enum: ModeloIA 
  })
  modeloPadrao: ModeloIA;

  @ApiProperty({ 
    description: 'Se o serviço está habilitado',
    example: true 
  })
  habilitado: boolean;

  @ApiPropertyOptional({ 
    description: 'Temperatura padrão utilizada',
    example: 0.3 
  })
  temperaturaPadrao?: number;

  @ApiPropertyOptional({ 
    description: 'Limite máximo de tokens por requisição',
    example: 4000 
  })
  maxTokensPorRequisicao?: number;

  @ApiPropertyOptional({ 
    description: 'Timeout para processamento (ms)',
    example: 60000 
  })
  timeout?: number;

  @ApiPropertyOptional({ 
    description: 'Limite de requisições por minuto',
    example: 50 
  })
  limitePorMinuto?: number;
}

export class RelatorioIADto {
  @ApiProperty({ 
    description: 'Total de processamentos de IA realizados',
    example: 2500 
  })
  totalProcessamentos: number;

  @ApiProperty({ 
    description: 'Processamentos realizados hoje',
    example: 120 
  })
  processamentosHoje: number;

  @ApiProperty({ 
    description: 'Processamentos bem-sucedidos',
    example: 2350 
  })
  sucessos: number;

  @ApiProperty({ 
    description: 'Processamentos com erro',
    example: 150 
  })
  erros: number;

  @ApiProperty({ 
    description: 'Taxa de sucesso (%)',
    example: '94.0%' 
  })
  taxaSucesso: string;

  @ApiProperty({ 
    description: 'Tokens totais utilizados',
    example: 1250000 
  })
  tokensTotaisUtilizados: number;

  @ApiProperty({ 
    description: 'Custo estimado total (USD)',
    example: 15.75 
  })
  custoEstimado: number;

  @ApiProperty({ 
    description: 'Tempo médio de processamento (ms)',
    example: 3200 
  })
  tempoMedioProcessamento: number;

  @ApiProperty({ 
    description: 'Confiança média das análises',
    example: 0.887 
  })
  confiancaMedia: number;

  @ApiProperty({ 
    description: 'Estatísticas por tipo de análise',
    example: {
      'NORMALIZACAO_EXAMES': 1200,
      'INTERPRETACAO_DOCUMENTO': 800,
      'EXTRACAO_DADOS_ESTRUTURADOS': 500
    } 
  })
  porTipoAnalise: Record<string, number>;

  @ApiProperty({ 
    description: 'Estatísticas por modelo de IA',
    example: {
      'CLAUDE_SONNET': 1800,
      'CLAUDE_HAIKU': 700
    } 
  })
  porModelo: Record<string, number>;
}