import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, MaxLength } from 'class-validator';
import { TipoDocumento } from './create-documento.dto';
import { StatusDocumento } from './query-documento.dto';

export class UpdateDocumentoDto {
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

  @ApiPropertyOptional({ 
    enum: StatusDocumento,
    description: 'Status do documento'
  })
  @IsOptional()
  @IsEnum(StatusDocumento)
  status?: StatusDocumento;

  @ApiPropertyOptional({ description: 'Tags para categorização' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Metadados adicionais' })
  @IsOptional()
  metadados?: any;

  @ApiPropertyOptional({ description: 'Observações' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}