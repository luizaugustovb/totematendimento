import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsBoolean } from 'class-validator';

/**
 * DTO para processamento de documento CNH/RG
 */
export class ProcessarDocumentoDto {
  @ApiProperty({ 
    description: 'Imagem do documento em base64',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' 
  })
  @IsString()
  @IsNotEmpty()
  imagem: string;

  @ApiPropertyOptional({ 
    description: 'Dados extraídos via OCR (opcional, se já processado no frontend)',
    type: 'object'
  })
  @IsObject()
  @IsOptional()
  dados_ocr?: {
    cpf?: string;
    rg?: string;
    nome?: string;
    data_nascimento?: string;
    nome_mae?: string;
    texto_completo?: string;
  };
}

/**
 * DTO para resposta de consulta de cliente
 */
export class ConsultaClienteResponseDto {
  @ApiProperty({ description: 'Indica se a operação foi bem-sucedida' })
  success: boolean;

  @ApiProperty({ description: 'Indica se o cliente foi encontrado no banco' })
  cliente_encontrado: boolean;

  @ApiPropertyOptional({ description: 'Dados do cliente encontrado', type: 'object' })
  dados_cliente?: {
    id: string;
    codigo_cliente?: string;
    nome: string;
    cpf: string;
    rg?: string;
    data_nascimento?: string;
    telefone?: string;
    celular?: string;
    email?: string;
    endereco?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    nome_mae?: string;
  };

  @ApiPropertyOptional({ description: 'Dados extraídos do OCR', type: 'object' })
  dados_ocr?: any;

  @ApiPropertyOptional({ description: 'Mensagem de erro', example: 'Cliente não encontrado' })
  mensagem?: string;
}

/**
 * DTO para processamento de carteirinha de convênio
 */
export class ProcessarCarteirinhaDto {
  @ApiProperty({ 
    description: 'Imagem da carteirinha em base64',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' 
  })
  @IsString()
  @IsNotEmpty()
  imagem: string;

  @ApiPropertyOptional({ 
    description: 'Convênio selecionado pelo usuário',
    example: 'unimed'
  })
  @IsString()
  @IsOptional()
  convenio?: string;

  @ApiPropertyOptional({ 
    description: 'Dados extraídos via OCR (opcional)',
    type: 'object'
  })
  @IsObject()
  @IsOptional()
  dados_ocr?: {
    numero_carteirinha?: string;
    nome_titular?: string;
    validade?: string;
    convenio?: string;
    plano?: string;
    texto_completo?: string;
  };
}

/**
 * DTO para salvar atendimento completo
 */
export class SalvarAtendimentoDto {
  @ApiPropertyOptional({ 
    description: 'ID do cliente (se já existente)',
  })
  @IsString()
  @IsOptional()
  cliente_id?: string;

  @ApiProperty({ 
    description: 'Dados do cliente (novos ou atualizados)',
    type: 'object'
  })
  @IsObject()
  @IsNotEmpty()
  dados_cliente: {
    nome: string;
    cpf: string;
    rg?: string;
    data_nascimento?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
    nome_mae?: string;
  };

  @ApiProperty({ 
    description: 'Convênio selecionado',
    example: 'unimed'
  })
  @IsString()
  @IsNotEmpty()
  convenio: string;

  @ApiProperty({ 
    description: 'Dados da carteirinha do convênio',
    type: 'object'
  })
  @IsObject()
  @IsNotEmpty()
  dados_carteirinha: {
    numero_carteirinha?: string;
    nome_titular?: string;
    validade?: string;
    convenio?: string;
    plano?: string;
  };

  @ApiProperty({ 
    description: 'Imagem do documento (CNH/RG) em base64',
  })
  @IsString()
  @IsNotEmpty()
  imagem_documento: string;

  @ApiProperty({ 
    description: 'Imagem da carteirinha em base64',
  })
  @IsString()
  @IsNotEmpty()
  imagem_carteirinha: string;

  @ApiPropertyOptional({ 
    description: 'Imagem das guias médicas em base64',
  })
  @IsString()
  @IsOptional()
  imagem_guias?: string;

  @ApiPropertyOptional({ 
    description: 'Indica se o cliente confirmou seus dados',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  cliente_confirmado?: boolean;
}

/**
 * DTO para resposta de salvamento de atendimento
 */
export class SalvarAtendimentoResponseDto {
  @ApiProperty({ description: 'Indica se a operação foi bem-sucedida' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Protocolo de atendimento gerado' })
  protocolo?: string;

  @ApiPropertyOptional({ description: 'ID do atendimento criado' })
  atendimento_id?: string;

  @ApiPropertyOptional({ description: 'ID do cliente (novo ou existente)' })
  cliente_id?: string;

  @ApiPropertyOptional({ description: 'Mensagem de retorno' })
  message?: string;

  @ApiPropertyOptional({ description: 'Dados salvos (para confirmação)', type: 'object' })
  dados?: any;
}
