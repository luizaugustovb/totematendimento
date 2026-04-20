import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { IntegrationUploadController } from './integration-upload.controller';
import { IntegrationGateway } from './integration.gateway';
import { AuthModule } from '../auth/auth.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { IaModule } from '../ia/ia.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    JwtModule.register({}), // Configuration will come from global JWT module
    MulterModule.register({
      dest: './storage/uploads',
    }),
    AuthModule,
    DocumentosModule, 
    IaModule,
    LogsModule,
  ],
  controllers: [
    IntegrationController,
    IntegrationUploadController,
  ],
  providers: [
    IntegrationService,
    IntegrationGateway,
  ],
  exports: [
    IntegrationService,
    IntegrationGateway,
  ],
})
export class IntegrationModule {}
