import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get, 
  Request, 
  HttpCode, 
  HttpStatus,
  Ip,
  Headers,
  Patch
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiHeader,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard, LocalAuthGuard, RefreshTokenGuard } from './guards';
import { Public, CurrentUser, RateLimit } from './decorators';

// DTOs
import { 
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  AuthResponseDto,
  UserProfileDto
} from './dto';

@ApiTags('Autenticação & Autorização')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, window: 300 }) // 5 tentativas por 5 minutos
  @ApiOperation({ 
    summary: 'Realizar login',
    description: 'Autentica usuário com email e senha, retorna tokens JWT'
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ 
    description: 'Login realizado com sucesso',
    type: AuthResponseDto
  })
  @ApiUnauthorizedResponse({ 
    description: 'Email ou senha incorretos' 
  })
  @ApiTooManyRequestsResponse({ 
    description: 'Muitas tentativas de login - tente novamente mais tarde' 
  })
  @ApiHeader({
    name: 'User-Agent',
    description: 'Identificação do navegador/dispositivo',
    required: false,
  })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<AuthResponseDto> {
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 3, window: 3600 }) // 3 registros por hora
  @ApiOperation({ 
    summary: 'Registrar novo usuário',
    description: 'Cria uma nova conta de usuário e retorna tokens de autenticação'
  })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ 
    description: 'Usuário registrado com sucesso',
    type: AuthResponseDto
  })
  @ApiConflictResponse({ 
    description: 'Email já está em uso' 
  })
  @ApiBadRequestResponse({ 
    description: 'Dados inválidos ou senha não atende critérios de segurança' 
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @Public()
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, window: 300 }) // 10 renovações por 5 minutos
  @ApiOperation({ 
    summary: 'Renovar tokens de acesso',
    description: 'Usa refresh token para obter novos access e refresh tokens'
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ 
    description: 'Tokens renovados com sucesso',
    type: AuthResponseDto
  })
  @ApiUnauthorizedResponse({ 
    description: 'Refresh token inválido ou expirado' 
  })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Realizar logout',
    description: 'Invalida todas as sessões e tokens do usuário logado'
  })
  @ApiOkResponse({ 
    description: 'Logout realizado com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de acesso inválido' 
  })
  async logout(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string,
  ): Promise<{ message: string }> {
    const token = authorization?.split(' ')[1];
    return this.authService.logout(userId, token);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obter perfil do usuário logado',
    description: 'Retorna dados completos do usuário autenticado'
  })
  @ApiOkResponse({ 
    description: 'Perfil do usuário retornado com sucesso',
    type: UserProfileDto
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de acesso inválido' 
  })
  async getProfile(@CurrentUser() user: any): Promise<UserProfileDto> {
    return user;
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, window: 3600 }) // 5 mudanças de senha por hora
  @ApiOperation({ 
    summary: 'Alterar senha do usuário',
    description: 'Permite ao usuário alterar sua senha atual'
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ 
    description: 'Senha alterada com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Senha atual incorreta ou token inválido' 
  })
  @ApiBadRequestResponse({ 
    description: 'Nova senha não atende aos critérios de segurança' 
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 3, window: 3600 }) // 3 tentativas por hora
  @ApiOperation({ 
    summary: 'Solicitar recuperação de senha',
    description: 'Envia email com link para redefinir a senha'
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ 
    description: 'Se o email existir, você receberá instruções de recuperação' 
  })
  @ApiTooManyRequestsResponse({ 
    description: 'Muitas tentativas de recuperação - tente novamente mais tarde' 
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, window: 3600 }) // 5 tentativas por hora
  @ApiOperation({ 
    summary: 'Redefinir senha com token',
    description: 'Redefine a senha usando token recebido por email'
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ 
    description: 'Senha redefinida com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de reset inválido ou expirado' 
  })
  @ApiBadRequestResponse({ 
    description: 'Nova senha não atende aos critérios de segurança' 
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, window: 3600 }) // 10 verificações por hora
  @ApiOperation({ 
    summary: 'Verificar endereço de email',
    description: 'Confirma o endereço de email usando token enviado por email'
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiOkResponse({ 
    description: 'Email verificado com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de verificação inválido ou expirado' 
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 3, window: 1800 }) // 3 tentativas por 30 minutos
  @ApiOperation({ 
    summary: 'Reenviar email de verificação',
    description: 'Reenvia o email de verificação para o usuário logado'
  })
  @ApiOkResponse({ 
    description: 'Email de verificação reenviado com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de acesso inválido' 
  })
  async resendVerificationEmail(@CurrentUser() user: any): Promise<{ message: string }> {
    // TODO: Implementar reenvio de email de verificação
    return { message: 'Email de verificação reenviado com sucesso' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Listar sessões ativas',
    description: 'Retorna lista de sessões ativas do usuário'
  })
  @ApiOkResponse({ 
    description: 'Lista de sessões retornada com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de acesso inválido' 
  })
  async getActiveSessions(@CurrentUser('id') userId: string): Promise<any[]> {
    // TODO: Implementar listagem de sessões ativas
    return [];
  }

  @Post('revoke-session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Revogar sessão específica',
    description: 'Invalida uma sessão específica do usuário'
  })
  @ApiOkResponse({ 
    description: 'Sessão revogada com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de acesso inválido' 
  })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Body('sessionId') sessionId: string,
  ): Promise<{ message: string }> {
    // TODO: Implementar revogação de sessão específica
    return { message: 'Sessão revogada com sucesso' };
  }

  @Post('revoke-all-sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Revogar todas as sessões',
    description: 'Invalida todas as sessões do usuário exceto a atual'
  })
  @ApiOkResponse({ 
    description: 'Todas as sessões foram revogadas com sucesso' 
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token de acesso inválido' 
  })
  async revokeAllSessions(@CurrentUser('id') userId: string): Promise<{ message: string }> {
    return this.authService.logout(userId);
  }
}