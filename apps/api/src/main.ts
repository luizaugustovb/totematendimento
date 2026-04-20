import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';

async function bootstrap() {
  // Configurar Winston Logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: { service: 'laboratorio-api' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
    ],
  });

  // Adicionar transporte de arquivo se habilitado
  if (process.env.LOG_FILE_ENABLED === 'true') {
    logger.add(
      new winston.transports.File({
        filename: `${process.env.LOG_FILE_PATH || './logs'}/error.log`,
        level: 'error',
      }),
    );
    logger.add(
      new winston.transports.File({
        filename: `${process.env.LOG_FILE_PATH || './logs'}/combined.log`,
      }),
    );
  }

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });

  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 3000);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS - Configuração permissiva para desenvolvimento
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    // Desenvolvimento: permite todas as origens
    app.enableCors({
      origin: true, // Permite qualquer origem
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });
  } else {
    // Produção: apenas origens específicas
    const corsOrigins = configService.get('CORS_ORIGINS', 'http://localhost:3001,http://localhost:3002,http://localhost:8080');
    app.enableCors({
      origin: corsOrigins.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });
  }

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger Documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Laboratório - Autoatendimento API')
      .setDescription('API para sistema de autoatendimento laboratorial')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  logger.info(`🚀 API rodando na porta ${port}`);
  logger.info(`📚 Documentação disponível em http://localhost:${port}/api/docs`);
}

bootstrap();