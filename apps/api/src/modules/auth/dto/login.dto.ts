import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @ApiProperty({ 
    description: 'Email do usuário',
    example: 'usuario@exemplo.com'
  })
  @IsEmail({}, { message: 'Email deve ter um formato válido' })
  email: string;

  @ApiProperty({ 
    description: 'Senha do usuário',
    example: '123456',
    minLength: 6
  })
  @IsString()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  password: string;

  @ApiProperty({ 
    description: 'Manter sessão ativa por mais tempo',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean = false;
}