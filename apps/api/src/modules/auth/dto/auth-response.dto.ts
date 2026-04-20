import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ 
    description: 'Token de acesso JWT',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({ 
    description: 'Token para renovar o access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refreshToken: string;

  @ApiProperty({ 
    description: 'Tipo do token',
    example: 'Bearer'
  })
  tokenType: string = 'Bearer';

  @ApiProperty({ 
    description: 'Tempo de validade do access token em segundos',
    example: 900
  })
  expiresIn: number;

  @ApiProperty({ 
    description: 'Dados do usuário autenticado'
  })
  user: UserProfileDto;
}

export class UserProfileDto {
  @ApiProperty({ description: 'ID único do usuário' })
  id: string;

  @ApiProperty({ description: 'Nome do usuário' })
  name: string;

  @ApiProperty({ description: 'Email do usuário' })
  email: string;

  @ApiPropertyOptional({ description: 'Telefone do usuário' })
  telefone?: string;

  @ApiPropertyOptional({ description: 'CPF do usuário' })
  cpf?: string;

  @ApiProperty({ description: 'Status do usuário' })
  ativo: boolean;

  @ApiProperty({ description: 'Email foi verificado' })
  emailVerificado: boolean;

  @ApiProperty({ description: 'Data de criação da conta' })
  createdAt: Date;

  @ApiProperty({ description: 'Data da última atualização' })
  updatedAt: Date;
}