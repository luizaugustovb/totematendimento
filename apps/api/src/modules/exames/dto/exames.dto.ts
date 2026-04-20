import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExameDto {
  @ApiProperty({
    description: 'Nome padronizado do exame',
    example: 'Glicose'
  })
  @IsString()
  nomePadrao: string;

  @ApiPropertyOptional({
    description: 'Código interno do laboratório',
    example: 'GLI001'
  })
  @IsString()
  @IsOptional()
  codigoInterno?: string;

  @ApiPropertyOptional({
    description: 'Código TUSS do exame',
    example: '40304051'
  })
  @IsString()
  @IsOptional()
  codigoTuss?: string;

  @ApiPropertyOptional({
    description: 'Setor responsável pelo exame',
    example: 'Bioquímica'
  })
  @IsString()
  @IsOptional()
  setor?: string;

  @ApiPropertyOptional({
    description: 'Material necessário para coleta',
    example: 'Soro'
  })
  @IsString()
  @IsOptional()
  material?: string;

  @ApiPropertyOptional({
    description: 'Se o exame está ativo',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

export class UpdateExameDto extends CreateExameDto {}

export class ExameResponseDto {
  @ApiProperty({ description: 'ID único do exame' })
  id: string;

  @ApiProperty({ description: 'Nome padronizado do exame' })
  nomePadrao: string;

  @ApiProperty({ description: 'Código interno do laboratório' })
  codigoInterno: string | null;

  @ApiProperty({ description: 'Código TUSS do exame' })
  codigoTuss: string | null;

  @ApiProperty({ description: 'Setor responsável pelo exame' })
  setor: string | null;

  @ApiProperty({ description: 'Material necessário para coleta' })
  material: string | null;

  @ApiProperty({ description: 'Se o exame está ativo' })
  ativo: boolean;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  updatedAt: Date;

  @ApiProperty({ description: 'Quantidade de sinônimos cadastrados' })
  totalSinonimos?: number;
}