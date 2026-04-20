import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { RedisModule } from '../../core/redis/redis.module';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { RefreshTokenService } from './services/refresh-token.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LoggerModule,
    RedisModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '15m'),
          issuer: configService.get<string>('JWT_ISSUER', 'laboratorio-api'),
          audience: configService.get<string>('JWT_AUDIENCE', 'laboratorio-app'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    SessionService,
    RefreshTokenService,
    JwtStrategy,
    LocalStrategy,
    JwtRefreshStrategy,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    PasswordService,
    SessionService,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}