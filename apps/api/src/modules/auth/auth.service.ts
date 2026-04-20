import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Services
import { TokenService, TokenPair } from './services/token.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { RefreshTokenService } from './services/refresh-token.service';

// DTOs
import { 
  LoginDto, 
  RegisterDto, 
  ChangePasswordDto, 
  ForgotPasswordDto, 
  ResetPasswordDto,
  RefreshTokenDto,
  VerifyEmailDto,
  AuthResponseDto,
  UserProfileDto
} from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private loggerService: LoggerService,
    private jwtService: JwtService,
    private tokenService: TokenService,
    private passwordService: PasswordService,
    private sessionService: SessionService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  // Login com funcionalidades completas
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, password, rememberMe } = loginDto;

    try {
      this.loggerService.info(
        `Tentativa de login para email: ${email}`,
        'AuthService',
      );

      // Validar usuário e senha
      const user = await this.validateUserCredentials(email, password);
      
      if (!user) {
        this.loggerService.warn(`Login falhou para email: ${email}`, 'AuthService');
        throw new UnauthorizedException('Email ou senha incorretos');
      }

      if (!user.ativo) {
        this.loggerService.warn(`Tentativa de login com conta inativa: ${email}`, 'AuthService');
        throw new UnauthorizedException('Conta desativada. Entre em contato com o administrador');
      }

      // Criar sessão
      const sessionId = await this.sessionService.createSession(
        user,
        'temp', // Será substituído pelo token real
        ipAddress,
        userAgent,
        rememberMe || false,
      );

      // Gerar tokens
      const tokenPair = await this.tokenService.generateTokenPair(
        user,
        sessionId,
        rememberMe || false,
      );

      // Armazenar refresh token
      await this.refreshTokenService.storeRefreshToken(
        user,
        tokenPair.refreshToken,
        rememberMe || false,
        ipAddress,
        userAgent,
      );

      // Atualizar último login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { 
          ultimoLogin: new Date(),
          updatedAt: new Date(),
        },
      });

      // Log de sucesso
      this.loggerService.info(`Login bem-sucedido para usuário: ${email}`, 'AuthService');
      
      await this.logLoginActivity(user.id, 'LOGIN_SUCCESS', {
        email,
        ipAddress,
        userAgent,
        rememberMe: rememberMe || false,
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
        user: this.mapUserToProfile(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.logLoginActivity(null, 'LOGIN_FAILED', {
          email,
          ipAddress,
          userAgent,
          error: error.message,
        });
      }
      throw error;
    }
  }

  // Registro de novo usuário
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { name, email, password, telefone, cpf } = registerDto;

    try {
      this.loggerService.info(`Tentativa de registro para email: ${email}`, 'AuthService');

      // Verificar se email já existe
      const existingUser = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictException('Email já está em uso');
      }

      // Verificar força da senha
      const passwordStrength = await this.passwordService.isPasswordStrong(password);
      if (!passwordStrength.isStrong) {
        throw new BadRequestException({
          message: 'Senha não atende aos critérios de segurança',
          errors: passwordStrength.errors,
        });
      }

      // Hash da senha
      const hashedPassword = await this.passwordService.hashPassword(password);

      // Criar usuário
      const user = await this.prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          telefone,
          cpf,
          ativo: true,
          emailVerificado: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.loggerService.info(`Usuário criado com sucesso: ${email}`, 'AuthService');

      // Gerar tokens para auto-login
      const tokenPair = await this.tokenService.generateTokenPair(user);

      // Armazenar refresh token
      await this.refreshTokenService.storeRefreshToken(user, tokenPair.refreshToken);

      await this.logLoginActivity(user.id, 'USER_REGISTERED', {
        email,
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
        user: this.mapUserToProfile(user),
      };
    } catch (error) {
      this.loggerService.error(
        `Erro no registro de usuário ${email}: ${error.message}`,
        'AuthService',
      );
      throw error;
    }
  }

  // Refresh token
  async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verificar refresh token
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      if (!payload) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      // Buscar usuário
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub, ativo: true },
      });

      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      // Validar refresh token no serviço
      const isValid = await this.refreshTokenService.validateRefreshToken(
        user.id,
        refreshToken,
      );

      if (!isValid) {
        throw new UnauthorizedException('Refresh token expirado ou inválido');
      }

      // Gerar novos tokens
      const tokenPair = await this.tokenService.generateTokenPair(user);

      // Armazenar novo refresh token e revogar o anterior
      await this.refreshTokenService.revokeRefreshToken(user.id, refreshToken);
      await this.refreshTokenService.storeRefreshToken(user, tokenPair.refreshToken);

      this.loggerService.debug(
        `Tokens renovados para usuário: ${user.email}`,
        'AuthService',
      );

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
        user: this.mapUserToProfile(user),
      };
    } catch (error) {
      this.loggerService.error(
        `Erro ao renovar tokens: ${error.message}`,
        'AuthService',
      );
      throw error;
    }
  }

  // Validar credenciais do usuário
  async validateUserCredentials(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        return null;
      }

      const isValidPassword = await this.passwordService.comparePasswords(
        password,
        user.password,
      );

      return isValidPassword ? user : null;
    } catch (error) {
      this.loggerService.error(
        `Erro na validação de credenciais: ${error.message}`,
        'AuthService',
      );
      return null;
    }
  }

  // Validar usuário por ID
  async validateUser(userId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId, ativo: true },
      });
    } catch (error) {
      this.loggerService.error(
        `Erro ao validar usuário ${userId}: ${error.message}`,
        'AuthService',
      );
      return null;
    }
  }

  // Logout
  async logout(userId: string, token?: string): Promise<{ message: string }> {
    try {
      if (token) {
        // Invalidar sessão específica
        const isValid = await this.sessionService.isValidSession(userId, token);
        if (isValid) {
          // TODO: Implementar invalidação da sessão específica
        }
      }

      // Revogar todos os refresh tokens do usuário
      await this.refreshTokenService.revokeAllUserRefreshTokens(userId);

      // Invalidar todas as sessões
      await this.sessionService.invalidateUserSessions(userId);

      await this.logLoginActivity(userId, 'LOGOUT', {});

      this.loggerService.info(`Logout realizado para usuário: ${userId}`, 'AuthService');

      return { message: 'Logout realizado com sucesso' };
    } catch (error) {
      this.loggerService.error(
        `Erro no logout para usuário ${userId}: ${error.message}`,
        'AuthService',
      );
      throw error;
    }
  }

  // Alterar senha
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      // Verificar senha atual
      const isCurrentPasswordValid = await this.passwordService.comparePasswords(
        currentPassword,
        user.password,
      );

      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('Senha atual incorreta');
      }

      // Verificar força da nova senha
      const passwordStrength = await this.passwordService.isPasswordStrong(newPassword);
      if (!passwordStrength.isStrong) {
        throw new BadRequestException({
          message: 'Nova senha não atende aos critérios de segurança',
          errors: passwordStrength.errors,
        });
      }

      // Hash da nova senha
      const hashedNewPassword = await this.passwordService.hashPassword(newPassword);

      // Atualizar senha
      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      });

      // Revogar todos os tokens existentes por segurança
      await this.refreshTokenService.revokeAllUserRefreshTokens(userId);
      await this.sessionService.invalidateUserSessions(userId);

      await this.logLoginActivity(userId, 'PASSWORD_CHANGED', {});

      this.loggerService.info(`Senha alterada para usuário: ${userId}`, 'AuthService');

      return { message: 'Senha alterada com sucesso' };
    } catch (error) {
      this.loggerService.error(
        `Erro ao alterar senha para usuário ${userId}: ${error.message}`,
        'AuthService',
      );
      throw error;
    }
  }

  // Esqueci minha senha
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // Não revelar se o email existe ou não por segurança
        return { message: 'Se o email existir, você receberá instruções de recuperação' };
      }

      // Gerar token de reset
      const resetToken = await this.passwordService.createPasswordResetToken(user.id);

      // TODO: Enviar email com token de reset
      // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

      await this.logLoginActivity(user.id, 'PASSWORD_RESET_REQUESTED', { email });

      this.loggerService.info(`Token de reset enviado para: ${email}`, 'AuthService');

      return { message: 'Se o email existir, você receberá instruções de recuperação' };
    } catch (error) {
      this.loggerService.error(
        `Erro ao processar esqueci minha senha para ${email}: ${error.message}`,
        'AuthService',
      );
      return { message: 'Se o email existir, você receberá instruções de recuperação' };
    }
  }

  // Reset de senha
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    try {
      // Decodificar token para obter user ID (implementação simplificada)
      // Em produção, usar JWT ou hash mais seguro
      const payload = await this.tokenService.verifyAccessToken(token);
      if (!payload) {
        throw new UnauthorizedException('Token de reset inválido ou expirado');
      }

      const userId = payload.sub;

      // Validar token de reset
      const isValidToken = await this.passwordService.validatePasswordResetToken(
        userId,
        token,
      );

      if (!isValidToken) {
        throw new UnauthorizedException('Token de reset inválido ou expirado');
      }

      // Verificar força da nova senha
      const passwordStrength = await this.passwordService.isPasswordStrong(newPassword);
      if (!passwordStrength.isStrong) {
        throw new BadRequestException({
          message: 'Nova senha não atende aos critérios de segurança',
          errors: passwordStrength.errors,
        });
      }

      // Hash da nova senha
      const hashedPassword = await this.passwordService.hashPassword(newPassword);

      // Atualizar senha
      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });

      // Invalidar token de reset
      await this.passwordService.invalidatePasswordResetTokens(userId);

      // Revogar todas as sessões por segurança
      await this.refreshTokenService.revokeAllUserRefreshTokens(userId);
      await this.sessionService.invalidateUserSessions(userId);

      await this.logLoginActivity(userId, 'PASSWORD_RESET_COMPLETED', {});

      this.loggerService.info(`Password reset completado para usuário: ${userId}`, 'AuthService');

      return { message: 'Senha redefinida com sucesso' };
    } catch (error) {
      this.loggerService.error(
        `Erro no reset de senha: ${error.message}`,
        'AuthService',
      );
      throw error;
    }
  }

  // Verificar email (placeholder para implementação futura)
  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const { token } = verifyEmailDto;

    try {
      // TODO: Implementar verificação de email
      return { message: 'Email verificado com sucesso' };
    } catch (error) {
      this.loggerService.error(
        `Erro na verificação de email: ${error.message}`,
        'AuthService',
      );
      throw error;
    }
  }

  // Métodos auxiliares
  private mapUserToProfile(user: User): UserProfileDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      telefone: user.telefone,
      cpf: user.cpf,
      ativo: user.ativo,
      emailVerificado: user.emailVerificado || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async logLoginActivity(
    userId: string | null,
    action: string,
    details: Record<string, any>,
  ): Promise<void> {
    try {
      // Implementação futura: log de atividades de login
      this.loggerService.debug(
        `Login Activity: ${action} - ${JSON.stringify(details)}`,
        'AuthService',
      );
    } catch (error) {
      this.loggerService.error(
        `Erro ao registrar atividade de login: ${error.message}`,
        'AuthService',
      );
    }
  }
}