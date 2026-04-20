import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'contato@luizaugusto.me',
    description: 'E-mail do usuário administrador',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Luiz2012@',
    description: 'Senha do usuário administrador',
    minLength: 6,
  })
  @IsNotEmpty()
  @MinLength(6)
  senha: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Token JWT de acesso' })
  access_token: string;

  @ApiProperty({ description: 'Tipo do token' })
  token_type: string;

  @ApiProperty({ description: 'Tempo de expiração em segundos' })
  expires_in: number;

  @ApiProperty({ description: 'Dados do usuário logado' })
  user: {
    id: string;
    nome: string;
    email: string;
    perfil: string;
  };
}