import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 12;
  private readonly resetTokenExpiration = 1000 * 60 * 60; // 1 hora

  constructor(
    private logger: LoggerService,
    private prisma: PrismaService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      this.logger.debug('Senha hash gerada com sucesso', 'PasswordService');
      return hashedPassword;
    } catch (error) {
      this.logger.error(
        `Erro ao gerar hash da senha: ${error.message}`,
        'PasswordService',
      );
      throw new Error('Erro ao processar senha');
    }
  }

  async comparePasswords(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(plainTextPassword, hashedPassword);
      
      this.logger.debug(
        `Comparação de senha: ${isMatch ? 'sucesso' : 'falha'}`,
        'PasswordService',
      );
      
      return isMatch;
    } catch (error) {
      this.logger.error(
        `Erro ao comparar senhas: ${error.message}`,
        'PasswordService',
      );
      return false;
    }
  }

  async isPasswordStrong(password: string): Promise<{ isStrong: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Senha deve ter pelo menos 8 caracteres');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra minúscula');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra maiúscula');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Senha deve conter pelo menos um número');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Senha deve conter pelo menos um caractere especial (@$!%*?&)');
    }

    // Verifica padrões comuns
    const commonPatterns = [
      /123456/,
      /password/i,
      /admin/i,
      /qwerty/i,
      /(.)\1{3,}/, // Caracteres repetidos
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Senha contém padrões comuns ou inseguros');
        break;
      }
    }

    return {
      isStrong: errors.length === 0,
      errors,
    };
  }

  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    try {
      const resetToken = this.generateResetToken();
      const hashedToken = await this.hashPassword(resetToken);
      const expiresAt = new Date(Date.now() + this.resetTokenExpiration);

      // Invalida tokens de reset anteriores
      await this.prisma.$executeRaw`
        DELETE FROM password_reset_tokens 
        WHERE user_id = ${userId}
      `;

      // Cria novo token de reset
      await this.prisma.$executeRaw`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
        VALUES (${userId}, ${hashedToken}, ${expiresAt}, NOW())
      `;

      this.logger.info(
        `Token de reset de senha criado para usuário ${userId}`,
        'PasswordService',
      );

      return resetToken;
    } catch (error) {
      this.logger.error(
        `Erro ao criar token de reset de senha: ${error.message}`,
        'PasswordService',
      );
      throw new Error('Erro ao gerar token de reset de senha');
    }
  }

  async validatePasswordResetToken(
    userId: string,
    resetToken: string,
  ): Promise<boolean> {
    try {
      // Busca tokens válidos para o usuário
      const tokens = await this.prisma.$queryRaw<
        Array<{ token_hash: string; expires_at: Date }>
      >`
        SELECT token_hash, expires_at 
        FROM password_reset_tokens 
        WHERE user_id = ${userId} 
          AND expires_at > NOW()
      `;

      if (tokens.length === 0) {
        this.logger.warn(
          `Nenhum token de reset válido encontrado para usuário ${userId}`,
          'PasswordService',
        );
        return false;
      }

      // Verifica se o token corresponde a algum dos hashs armazenados
      for (const tokenData of tokens) {
        const isValid = await this.comparePasswords(resetToken, tokenData.token_hash);
        if (isValid) {
          this.logger.info(
            `Token de reset validado para usuário ${userId}`,
            'PasswordService',
          );
          return true;
        }
      }

      this.logger.warn(
        `Token de reset inválido para usuário ${userId}`,
        'PasswordService',
      );
      return false;
    } catch (error) {
      this.logger.error(
        `Erro ao validar token de reset: ${error.message}`,
        'PasswordService',
      );
      return false;
    }
  }

  async invalidatePasswordResetTokens(userId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM password_reset_tokens 
        WHERE user_id = ${userId}
      `;

      this.logger.info(
        `Tokens de reset invalidados para usuário ${userId}`,
        'PasswordService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao invalidar tokens de reset: ${error.message}`,
        'PasswordService',
      );
      throw error;
    }
  }
}