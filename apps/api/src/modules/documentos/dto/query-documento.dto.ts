import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TipoDocumento } from './create-documento.dto';

export enum StatusDocumento {
  PENDENTE = 'PENDENTE',
  PROCESSANDO = 'PROCESSANDO',
  PROCESSADO = 'PROCESSADO',
  ERRO = 'ERRO',
  REJEITADO = 'REJEITADO'
}

export class QueryDocumentoDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou descrição' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ 
    enum: TipoDocumento,
    description: 'Filtro por tipo de documento'
  })
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipo?: TipoDocumento;

  @ApiPropertyOptional({ 
    enum: StatusDocumento,
    description: 'Filtro por status do documento'
  })
  @IsOptional()
  @IsEnum(StatusDocumento)
  status?: StatusDocumento;

  @ApiPropertyOptional({ description: 'Data de início (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data de fim (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Campo de ordenação' })
  @IsOptional()
  @IsString()
  ordenarPor?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Direção da ordenação' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  direcao?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Página (começa em 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({ description: 'Itens por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}