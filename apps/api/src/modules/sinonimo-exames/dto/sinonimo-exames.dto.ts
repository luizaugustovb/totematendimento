import { IsString, IsOptional, IsEnum, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EscopoSinonimo {
  GLOBAL = 'GLOBAL',
  MEDICO = 'MEDICO',
  CONVENIO = 'CONVENIO',
}

export enum TipoMatch {
  EXATO = 'EXATO',
  CONTEM = 'CONTEM',
  REGEX = 'REGEX',
  FUZZY = 'FUZZY',
  IA = 'IA',
}

export class CreateSinonimoExameDto {
  @ApiProperty({
    description: 'ID do exame ao qual o sinônimo se refere',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  exameId: string;

  @ApiProperty({
    description: 'Escopo do sinônimo',
    enum: EscopoSinonimo,
    example: EscopoSinonimo.GLOBAL
  })
  @IsEnum(EscopoSinonimo)
  escopo: EscopoSinonimo;

  @ApiPropertyOptional({
    description: 'ID do médico (obrigatório quando escopo for MEDICO)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsOptional()
  medicoId?: string;

  @ApiPropertyOptional({
    description: 'ID do convênio (obrigatório quando escopo for CONVENIO)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsOptional()
  convenioId?: string;

  @ApiProperty({
    description: 'Variação/sinônimo do nome do exame',
    example: 'gli'
  })
  @IsString()
  descricaoVariacao: string;

  @ApiProperty({
    description: 'Tipo de matching do sinônimo',
    enum: TipoMatch,
    example: TipoMatch.EXATO
  })
  @IsEnum(TipoMatch)
  tipoMatch: TipoMatch;

  @ApiPropertyOptional({
    description: 'Se o sinônimo está ativo',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

export class UpdateSinonimoExameDto extends CreateSinonimoExameDto {}

export class SinonimoExameResponseDto {
  @ApiProperty({ description: 'ID único do sinônimo' })
  id: string;

  @ApiProperty({ description: 'ID do exame' })
  exameId: string;

  @ApiProperty({ description: 'Escopo do sinônimo', enum: EscopoSinonimo })
  escopo: EscopoSinonimo;

  @ApiProperty({ description: 'ID do médico' })
  medicoId: string | null;

  @ApiProperty({ description: 'ID do convênio' })
  convenioId: string | null;

  @ApiProperty({ description: 'Variação/sinônimo do nome do exame' })
  descricaoVariacao: string;

  @ApiProperty({ description: 'Tipo de matching', enum: TipoMatch })
  tipoMatch: TipoMatch;

  @ApiProperty({ description: 'Se o sinônimo está ativo' })
  ativo: boolean;

  @ApiProperty({ description: 'ID do usuário que criou' })
  criadoPorUsuarioId: string;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  updatedAt: Date;

  @ApiProperty({ description: 'Dados do exame' })
  exame?: {
    id: string;
    nomePadrao: string;
    codigoInterno: string | null;
  };

  @ApiProperty({ description: 'Dados do médico' })
  medico?: {
    id: string;
    nome: string;
    crm: string;
  };

  @ApiProperty({ description: 'Dados do convênio' })
  convenio?: {
    id: string;
    nome: string;
    codigo: string;
  };

  @ApiProperty({ description: 'Dados do usuário que criou' })
  criadoPorUsuario?: {
    id: string;
    nome: string;
    email: string;
  };
}

export class NormalizarExameDto {
  @ApiProperty({
    description: 'Texto do exame a ser normalizado',
    example: 'gli'
  })
  @IsString()
  texto: string;

  @ApiPropertyOptional({
    description: 'ID do médico para contexto específico',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsOptional()
  medicoId?: string;

  @ApiPropertyOptional({
    description: 'ID do convênio para contexto específico',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsOptional()
  convenioId?: string;
}

export class ResultadoNormalizacaoDto {
  @ApiProperty({ description: 'Se foi encontrada uma correspondência' })
  encontrado: boolean;

  @ApiProperty({ description: 'Score de confiança (0-1)' })
  scoreConfianca: number;

  @ApiProperty({ description: 'Origem do match' })
  origemMatch: string;

  @ApiProperty({ description: 'Dados do exame encontrado' })
  exame?: {
    id: string;
    nomePadrao: string;
    codigoInterno: string | null;
    codigoTuss: string | null;
  };

  @ApiProperty({ description: 'Dados do sinônimo utilizado' })
  sinonimo?: {
    id: string;
    descricaoVariacao: string;
    tipoMatch: TipoMatch;
    escopo: EscopoSinonimo;
  };

  @ApiProperty({ description: 'Texto original normalizado' })
  textoNormalizado: string;
}