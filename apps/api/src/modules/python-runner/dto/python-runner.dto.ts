import { IsString, IsOptional, IsObject, IsNumber, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScriptPythonDto {
  @ApiProperty({
    description: 'Nome único do script',
    example: 'Autorização Unimed'
  })
  @IsString()
  nome: string;

  @ApiProperty({
    description: 'Caminho do arquivo Python',
    example: './python-scripts/autorizar_unimed.py'
  })
  @IsString()
  caminho: string;

  @ApiProperty({
    description: 'Parâmetros permitidos e seus tipos',
    example: {
      atendimento_id: 'string',
      convenio_codigo: 'string',
      exames: 'array',
      paciente_cpf: 'string',
      numero_carteira: 'string'
    }
  })
  @IsObject()
  parametrosPermitidosJson: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Timeout em segundos',
    default: 60,
    minimum: 10,
    maximum: 300
  })
  @IsNumber()
  @IsOptional()
  timeoutSegundos?: number;

  @ApiPropertyOptional({
    description: 'Se o script está ativo',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

export class UpdateScriptPythonDto extends CreateScriptPythonDto {}

export class ExecutarScriptDto {
  @ApiProperty({
    description: 'ID do script a ser executado',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  scriptId: string;

  @ApiProperty({
    description: 'ID do atendimento relacionado',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  atendimentoId: string;

  @ApiPropertyOptional({
    description: 'ID do convênio (opcional)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsOptional()
  convenioId?: string;

  @ApiProperty({
    description: 'Parâmetros para o script',
    example: {
      convenio_codigo: 'UNIMED',
      exames: [
        { nome: 'Glicose', codigo: 'GLI001' },
        { nome: 'Hemograma', codigo: 'HEM001' }
      ],
      paciente_cpf: '12345678900',
      numero_carteira: '1234567890123'
    }
  })
  @IsObject()
  parametrosJson: Record<string, any>;
}

export class ScriptPythonResponseDto {
  @ApiProperty({ description: 'ID único do script' })
  id: string;

  @ApiProperty({ description: 'Nome único do script' })
  nome: string;

  @ApiProperty({ description: 'Caminho do arquivo Python' })
  caminho: string;

  @ApiProperty({ description: 'Parâmetros permitidos' })
  parametrosPermitidosJson: Record<string, any>;

  @ApiProperty({ description: 'Timeout em segundos' })
  timeoutSegundos: number;

  @ApiProperty({ description: 'Se o script está ativo' })
  ativo: boolean;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  updatedAt: Date;

  @ApiProperty({ description: 'Total de execuções' })
  totalExecucoes?: number;
}

export class ExecucaoPythonResponseDto {
  @ApiProperty({ description: 'ID único da execução' })
  id: string;

  @ApiProperty({ description: 'ID do atendimento' })
  atendimentoId: string;

  @ApiProperty({ description: 'ID do script' })
  scriptId: string;

  @ApiProperty({ description: 'ID do convênio' })
  convenioId: string | null;

  @ApiProperty({ description: 'Parâmetros utilizados' })
  parametrosJson: Record<string, any>;

  @ApiProperty({ 
    description: 'Status da execução',
    enum: ['PENDENTE', 'EXECUTANDO', 'CONCLUIDO', 'ERRO', 'TIMEOUT', 'CANCELADO']
  })
  status: string;

  @ApiProperty({ description: 'Saída padrão do script' })
  stdout: string | null;

  @ApiProperty({ description: 'Saída de erro do script' })
  stderr: string | null;

  @ApiProperty({ description: 'Código de retorno' })
  codigoRetorno: number | null;

  @ApiProperty({ description: 'Timestamp de início' })
  startedAt: Date | null;

  @ApiProperty({ description: 'Timestamp de fim' })
  finishedAt: Date | null;

  @ApiProperty({ description: 'Duração em milissegundos' })
  duracao?: number;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  updatedAt: Date;

  @ApiProperty({ description: 'Dados do script' })
  script?: {
    id: string;
    nome: string;
    caminho: string;
  };

  @ApiProperty({ description: 'Dados do convênio' })
  convenio?: {
    id: string;
    nome: string;
    codigo: string;
  };
}

export class ResultadoExecucaoDto {
  @ApiProperty({ description: 'Se a execução foi bem-sucedida' })
  success: boolean;

  @ApiProperty({ description: 'ID da execução criada' })
  execucaoId: string;

  @ApiProperty({ description: 'Status atual' })
  status: string;

  @ApiProperty({ description: 'Resultado do script (se disponível)' })
  resultado?: any;

  @ApiProperty({ description: 'Mensagem de erro (se houver)' })
  erro?: string;
}