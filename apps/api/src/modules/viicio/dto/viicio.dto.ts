import { IsString, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnviarMensagemDto {
  @ApiProperty({
    description: 'ID do atendimento relacionado',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  atendimentoId: string;

  @ApiProperty({
    description: 'Número de telefone (formato internacional)',
    example: '5511999887766'
  })
  @IsString()
  telefone: string;

  @ApiProperty({
    description: 'Template de mensagem a ser usado',
    example: 'atendimento_cadastrado'
  })
  @IsString()
  template: string;

  @ApiPropertyOptional({
    description: 'Variáveis para substituição no template',
    example: {
      nome_paciente: 'João Silva',
      protocolo: 'PROT123456',
      unidade: 'Unidade Principal'
    }
  })
  @IsObject()
  @IsOptional()
  variaveis?: Record<string, any>;
}

export class TesteMensagemDto {
  @ApiProperty({
    description: 'Número de telefone para teste',
    example: '5511999887766'
  })
  @IsString()
  telefone: string;

  @ApiProperty({
    description: 'Mensagem de teste',
    example: 'Esta é uma mensagem de teste do sistema de autoatendimento.'
  })
  @IsString()
  mensagem: string;
}

export class MensagemViicioResponseDto {
  @ApiProperty({ description: 'ID único da mensagem' })
  id: string;

  @ApiProperty({ description: 'ID do atendimento' })
  atendimentoId: string;

  @ApiProperty({ description: 'Número de telefone' })
  telefone: string;

  @ApiProperty({ description: 'Template utilizado' })
  template: string;

  @ApiProperty({ description: 'Payload enviado' })
  payloadJson: Record<string, any>;

  @ApiProperty({ description: 'Resposta da API Viicio' })
  respostaJson: Record<string, any> | null;

  @ApiProperty({ 
    description: 'Status da mensagem',
    enum: ['PENDENTE', 'ENVIANDO', 'ENVIADO', 'ERRO', 'FALHOU_DEFINITIVO']
  })
  status: string;

  @ApiProperty({ description: 'Número de tentativas' })
  tentativas: number;

  @ApiProperty({ description: 'Data da última tentativa' })
  ultimaTentativa: Date | null;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  updatedAt: Date;
}

export class ConfiguracaoViicioDto {
  @ApiProperty({
    description: 'URL base da API Viicio',
    example: 'https://api.viicio.com.br'
  })
  @IsString()
  apiUrl: string;

  @ApiProperty({
    description: 'Token de autenticação da API',
    example: 'vii_abc123xyz...'
  })
  @IsString()
  apiToken: string;

  @ApiPropertyOptional({
    description: 'Se o serviço está habilitado',
    default: true
  })
  @IsOptional()
  habilitado?: boolean;

  @ApiPropertyOptional({
    description: 'Timeout em milissegundos',
    default: 30000
  })
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({
    description: 'Número máximo de tentativas',
    default: 3
  })
  @IsOptional()
  maxTentativas?: number;
}

export class TemplateViicioDto {
  @ApiProperty({
    description: 'Nome identificador do template',
    example: 'atendimento_cadastrado'
  })
  @IsString()
  nome: string;

  @ApiProperty({
    description: 'Texto do template com variáveis {{variavel}}',
    example: 'Olá {{nome_paciente}}! Seu atendimento foi cadastrado com sucesso. Protocolo: {{protocolo}}'
  })
  @IsString()
  texto: string;

  @ApiPropertyOptional({
    description: 'Descrição do template',
    example: 'Mensagem enviada após cadastro do atendimento no totem'
  })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({
    description: 'Se o template está ativo',
    default: true
  })
  @IsOptional()
  ativo?: boolean;
}

export class RelatorioMensagensDto {
  @ApiProperty({ description: 'Total de mensagens' })
  total: number;

  @ApiProperty({ description: 'Mensagens enviadas' })
  enviadas: number;

  @ApiProperty({ description: 'Mensagens com erro' })
  erros: number;

  @ApiProperty({ description: 'Mensagens pendentes' })
  pendentes: number;

  @ApiProperty({ description: 'Taxa de sucesso' })
  taxaSucesso: string;

  @ApiProperty({ description: 'Mensagens por status' })
  porStatus: Record<string, number>;

  @ApiProperty({ description: 'Mensagens por template' })
  porTemplate: Record<string, number>;
}