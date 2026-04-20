import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { User } from '@prisma/client';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    private authService: AuthService,
    private logger: LoggerService,
  ) {
    super({
      usernameField: 'email', // Usar email como campo de usuário
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<User> {
    try {
      this.logger.debug(
        `Tentativa de login com email: ${email}`,
        'LocalStrategy',
      );

      if (!email || !password) {
        this.logger.warn('Email ou senha não fornecidos', 'LocalStrategy');
        throw new UnauthorizedException('Email e senha são obrigatórios');
      }

      // Valida as credenciais usando o AuthService
      const user = await this.authService.validateUserCredentials(email, password);
      
      if (!user) {
        this.logger.warn(
          `Falha no login para email: ${email}`,
          'LocalStrategy',
        );
        throw new UnauthorizedException('Email ou senha incorretos');
      }

      if (!user.ativo) {
        this.logger.warn(
          `Tentativa de login com conta inativa: ${email}`,
          'LocalStrategy',
        );
        throw new UnauthorizedException('Conta desativada');
      }

      this.logger.info(
        `Login bem-sucedido para usuário: ${email}`,
        'LocalStrategy',
      );

      // Remove dados sensíveis
      const { password: _, ...safeUser } = user;
      return safeUser as User;
      
    } catch (error) {
      this.logger.error(
        `Erro na autenticação local: ${error.message}`,
        'LocalStrategy',
      );
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Erro no processo de autenticação');
    }
  }
}