import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ 
    description: 'Senha atual do usuário',
    example: 'senhaAtual123'
  })
  @IsString()
  @MinLength(6, { message: 'Senha atual deve ter pelo menos 6 caracteres' })
  currentPassword: string;

  @ApiProperty({ 
    description: 'Nova senha com pelo menos 8 caracteres, incluindo maiúscula, minúscula e número',
    example: 'NovaSenha@456',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Nova senha deve ter pelo menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { 
      message: 'Nova senha deve conter pelo menos: 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial' 
    }
  )
  newPassword: string;
}