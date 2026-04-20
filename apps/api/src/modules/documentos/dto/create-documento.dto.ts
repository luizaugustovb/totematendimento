import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, MaxLength } from 'class-validator';

export enum TipoDocumento {
  EXAME = 'EXAME',
  RECEITA = 'RECEITA', 
  LAUDO = 'LAUDO',
  IDENTIDADE = 'IDENTIDADE',
  CONVENIO = 'CONVENIO',
  OUTROS = 'OUTROS'
}

export class CreateDocumentoDto {
  @ApiPropertyOptional({ description: 'Nome do documento' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @ApiPropertyOptional({ description: 'Descrição do documento' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descricao?: string;

  @ApiPropertyOptional({ 
    enum: TipoDocumento,
    description: 'Tipo do documento'
  })
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipo?: TipoDocumento;

  @ApiPropertyOptional({ description: 'Tags para categorização' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Metadados adicionais' })
  @IsOptional()
  metadados?: any;
}