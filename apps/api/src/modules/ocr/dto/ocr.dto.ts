import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsBoolean, IsObject, IsNumber, ValidateNested, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum TipoAnaliseOCR {
  TEXTO_GERAL = 'TEXTO_GERAL',
  DOCUMENTO_MEDICO = 'DOCUMENTO_MEDICO',
  RECEITA_MEDICA = 'RECEITA_MEDICA',
  ATESTADO = 'ATESTADO',
  EXAME_LABORATORIAL = 'EXAME_LABORATORIAL',
  PEDIDO_EXAME = 'PEDIDO_EXAME',
  CARTEIRA_CONVENIO = 'CARTEIRA_CONVENIO',
  DOCUMENTO_IDENTIFICACAO = 'DOCUMENTO_IDENTIFICACAO',
}

export enum FormatoImagem {
  JPEG = 'JPEG',
  PNG = 'PNG',
  WEBP = 'WEBP',
  PDF = 'PDF',
  TIFF = 'TIFF',
}

export class ProcessarImagemOCRDto {
  @ApiProperty({ 
    description: 'Base64 da imagem ou URL do arquivo',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' 
  })
  @IsString()
  @IsNotEmpty()
  imagem: string;

  @ApiProperty({ 
    enum: TipoAnaliseOCR,
    description: 'Tipo de análise OCR a ser realizada',
    example: TipoAnaliseOCR.PEDIDO_EXAME 
  })
  @IsEnum(TipoAnaliseOCR)
  tipoAnalise: TipoAnaliseOCR;

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
    enum: FormatoImagem,
    description: 'Formato da imagem (detectado automaticamente se não informado)',
    example: FormatoImagem.JPEG 
  })
  @IsEnum(FormatoImagem)
  @IsOptional()
  formato?: FormatoImagem;

  @ApiPropertyOptional({ 
    description: 'Idiomas para detecção (padrão: português)',
    example: ['pt', 'en'],
    type: [String] 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  idiomas?: string[];

  @ApiPropertyOptional({ 
    description: 'Extrair também blocos de texto estruturados',
    example: true,
    default: true 
  })
  @IsBoolean()
  @IsOptional()
  extrairBlocos?: boolean;

  @ApiPropertyOptional({ 
    description: 'Detectar orientação e rotação da imagem',
    example: true,
    default: true 
  })
  @IsBoolean()
  @IsOptional()
  detectarOrientacao?: boolean;

  @ApiPropertyOptional({ 
    description: 'Configurações específicas para o tipo de documento',
    example: { extrairCamposEstruturados: true },
    type: 'object' 
  })
  @IsObject()
  @IsOptional()
  configuracoes?: Record<string, any>;
}

export class ConfiguracaoOCRDto {
  @ApiProperty({ 
    description: 'Provedor de OCR configurado',
    example: 'GOOGLE_VISION' 
  })
  @IsString()
  provedor: string;

  @ApiProperty({ 
    description: 'Se o serviço está habilitado',
    example: true 
  })
  @IsBoolean()
  habilitado: boolean;

  @ApiPropertyOptional({ 
    description: 'Limite de confiança mínima (0-1)',
    example: 0.7,
    minimum: 0,
    maximum: 1 
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  limiteConfianca?: number;

  @ApiPropertyOptional({ 
    description: 'Timeout para processamento (ms)',
    example: 30000 
  })
  @IsNumber()
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ 
    description: 'Tamanho máximo de arquivo (bytes)',
    example: 10485760 
  })
  @IsNumber()
  @IsOptional()
  tamanhoMaximoArquivo?: number;
}

export class BlocoTextoDto {
  @ApiProperty({ 
    description: 'Texto extraído do bloco',
    example: 'RECEITA MÉDICA' 
  })
  texto: string;

  @ApiProperty({ 
    description: 'Nível de confiança (0-1)',
    example: 0.95 
  })
  confianca: number;

  @ApiProperty({ 
    description: 'Coordenadas do bloco na imagem',
    example: { x: 100, y: 50, width: 300, height: 25 } 
  })
  coordenadas: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  @ApiProperty({ 
    description: 'Tipo de bloco (parágrafo, linha, palavra)',
    example: 'PARAGRAFO' 
  })
  tipo: string;
}

export class CampoExtraidoDto {
  @ApiProperty({ 
    description: 'Nome do campo',
    example: 'nome_medico' 
  })
  campo: string;

  @ApiProperty({ 
    description: 'Valor extraído',
    example: 'Dr. João Silva' 
  })
  valor: string;

  @ApiProperty({ 
    description: 'Confiança na extração',
    example: 0.88 
  })
  confianca: number;

  @ApiPropertyOptional({ 
    description: 'Coordenadas onde o campo foi encontrado' 
  })
  coordenadas?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class ResultadoOCRDto {
  @ApiProperty({ 
    description: 'Texto completo extraído',
    example: 'RECEITA MÉDICA\nDr. João Silva\nCRM: 12345...' 
  })
  textoCompleto: string;

  @ApiProperty({ 
    description: 'Confiança geral do OCR (0-1)',
    example: 0.92 
  })
  confiancaGeral: number;

  @ApiProperty({ 
    description: 'Tipo de análise realizada',
    enum: TipoAnaliseOCR 
  })
  tipoAnalise: TipoAnaliseOCR;

  @ApiProperty({ 
    description: 'Idiomas detectados',
    example: ['pt'] 
  })
  idiomasDetectados: string[];

  @ApiPropertyOptional({ 
    description: 'Orientação detectada (graus)',
    example: 0 
  })
  orientacao?: number;

  @ApiPropertyOptional({ 
    description: 'Blocos de texto estruturados',
    type: [BlocoTextoDto] 
  })
  blocos?: BlocoTextoDto[];

  @ApiPropertyOptional({ 
    description: 'Campos estruturados extraídos',
    type: [CampoExtraidoDto] 
  })
  camposEstruturados?: CampoExtraidoDto[];

  @ApiProperty({ 
    description: 'Tempo de processamento (ms)',
    example: 2500 
  })
  tempoProcessamento: number;

  @ApiProperty({ 
    description: 'ID do processamento para referência',
    example: 'ocr_12345_20240126' 
  })
  processamentoId: string;

  @ApiProperty({ 
    description: 'Metadados do processamento',
    example: { 
      tamanho_original: '1920x1080', 
      formato: 'JPEG', 
      provedor: 'GOOGLE_VISION' 
    } 
  })
  metadados: Record<string, any>;
}

export class TestarOCRDto {
  @ApiProperty({ 
    description: 'Base64 de uma imagem de teste',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' 
  })
  @IsString()
  @IsNotEmpty()
  imagemTeste: string;

  @ApiPropertyOptional({ 
    description: 'Texto esperado para validação',
    example: 'Texto que deveria ser reconhecido' 
  })
  @IsString()
  @IsOptional()
  textoEsperado?: string;
}

export class RelatorioOCRDto {
  @ApiProperty({ 
    description: 'Total de processamentos realizados',
    example: 1250 
  })
  totalProcessamentos: number;

  @ApiProperty({ 
    description: 'Processamentos realizados hoje',
    example: 45 
  })
  processamentosHoje: number;

  @ApiProperty({ 
    description: 'Processamentos bem-sucedidos',
    example: 1180 
  })
  sucessos: number;

  @ApiProperty({ 
    description: 'Processamentos com erro',
    example: 70 
  })
  erros: number;

  @ApiProperty({ 
    description: 'Taxa de sucesso (%)',
    example: '94.4%' 
  })
  taxaSucesso: string;

  @ApiProperty({ 
    description: 'Confiança média dos processamentos',
    example: 0.891 
  })
  confiancaMedia: number;

  @ApiProperty({ 
    description: 'Tempo médio de processamento (ms)',
    example: 2340 
  })
  tempoMedioProcessamento: number;

  @ApiProperty({ 
    description: 'Estatísticas por tipo de análise',
    example: {
      'PEDIDO_EXAME': 450,
      'RECEITA_MEDICA': 320,
      'DOCUMENTO_IDENTIFICACAO': 280,
      'CARTEIRA_CONVENIO': 200
    } 
  })
  porTipoAnalise: Record<string, number>;

  @ApiProperty({ 
    description: 'Estatísticas por formato de imagem',
    example: {
      'JPEG': 800,
      'PNG': 300,
      'PDF': 150
    } 
  })
  porFormato: Record<string, number>;
}

export class HistoricoOCRDto {
  @ApiProperty({ 
    description: 'ID do processamento',
    example: 'uuid-processamento' 
  })
  id: string;

  @ApiProperty({ 
    description: 'Data e hora do processamento',
    example: '2026-01-26T15:30:00Z' 
  })
  dataHora: Date;

  @ApiProperty({ 
    description: 'Tipo de análise',
    enum: TipoAnaliseOCR 
  })
  tipoAnalise: TipoAnaliseOCR;

  @ApiProperty({ 
    description: 'Status do processamento',
    example: 'SUCESSO' 
  })
  status: string;

  @ApiProperty({ 
    description: 'Confiança obtida',
    example: 0.95 
  })
  confianca: number;

  @ApiProperty({ 
    description: 'Tempo de processamento (ms)',
    example: 2100 
  })
  tempoProcessamento: number;

  @ApiPropertyOptional({ 
    description: 'ID do atendimento relacionado' 
  })
  atendimentoId?: string;

  @ApiPropertyOptional({ 
    description: 'ID do documento relacionado' 
  })
  documentoId?: string;

  @ApiPropertyOptional({ 
    description: 'Observações sobre o processamento' 
  })
  observacoes?: string;
}