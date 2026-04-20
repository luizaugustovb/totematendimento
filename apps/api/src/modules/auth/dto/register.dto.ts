import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength,
  IsOptional,
  Matches,
  IsPhoneNumber
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ 
    description: 'Nome completo do usuário',
    example: 'João Silva Santos',
    minLength: 2,
    maxLength: 100
  })
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  name: string;

  @ApiProperty({ 
    description: 'Email único do usuário',
    example: 'joao.silva@exemplo.com'
  })
  @IsEmail({}, { message: 'Email deve ter um formato válido' })
  email: string;

  @ApiProperty({ 
    description: 'Senha com pelo menos 8 caracteres, incluindo maiúscula, minúscula e número',
    example: 'MinhaSenh@123',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { 
      message: 'Senha deve conter pelo menos: 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial' 
    }
  )
  password: string;

  @ApiPropertyOptional({ 
    description: 'Telefone do usuário (formato brasileiro)',
    example: '(11) 99999-9999'
  })
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional({ 
    description: 'CPF do usuário (apenas números)',
    example: '12345678901'
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos' })
  cpf?: string;
}