import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { BullModule } from '@nestjs/bull';
import { join } from 'path';

// Core modules
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerModule } from './core/logger/logger.module';
import { RedisModule } from './core/redis/redis.module';

// Business modules
import { TotemModule } from './modules/totem/totem.module';
import { AdminModule } from './modules/admin/admin.module';
import { ConveniosModule } from './modules/convenios/convenios.module';
import { ExamesModule } from './modules/exames/exames.module';
import { SinonimoExamesModule } from './modules/sinonimo-exames/sinonimo-exames.module';
import { AtendimentosModule } from './modules/atendimentos/atendimentos.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
// import { OcrModule } from './modules/ocr/ocr.module'; // Temporariamente desabilitado
import { OcrComparisonModule } from './modules/ocr/ocr-comparison.module';
import { IaModule } from './modules/ia/ia.module';
import { ViicioModule } from './modules/viicio/viicio.module';
import { PythonRunnerModule } from './modules/python-runner/python-runner.module';
import { AprendizadoModule } from './modules/aprendizado/aprendizado.module';
import { ConfiguracoesModule } from './modules/configuracoes/configuracoes.module';
import { LogsModule } from './modules/logs/logs.module';
import { IntegracaoLegacyModule } from './modules/integracao-legacy/integracao-legacy.module';
import { IntegrationModule } from './modules/integration/integration.module';

// Worker modules
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    // Configuração global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        ttl: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
        limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      }),
    }),

    // Servir arquivos estáticos para uploads
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // Redis e Bull para filas
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_URL?.split('//')[1]?.split(':')[0] || 'localhost',
          port: parseInt(process.env.REDIS_URL?.split(':')[2] || '6379'),
        },
      }),
    }),

    // Core modules
    PrismaModule,
    AuthModule,
    LoggerModule,
    RedisModule,

    // Business modules
    TotemModule,
    AdminModule,
    ConveniosModule,
    ExamesModule,
    SinonimoExamesModule,
    AtendimentosModule,
    DocumentosModule,
    // OcrModule, // Temporariamente desabilitado
    OcrComparisonModule,
    IaModule,
    ViicioModule,
    PythonRunnerModule,
    AprendizadoModule,
    ConfiguracoesModule,
    LogsModule,
    IntegracaoLegacyModule,
    IntegrationModule,

    // Workers
    WorkersModule,
  ],
})
export class AppModule {}