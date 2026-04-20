import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { WorkersModule } from '../../workers/workers.module';
import { multerConfig } from './config/multer.config';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LoggerModule,
    WorkersModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: multerConfig,
      inject: [ConfigService],
    }),
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}