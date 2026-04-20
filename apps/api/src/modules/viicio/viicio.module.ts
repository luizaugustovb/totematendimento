import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ViicioController } from './viicio.controller';
import { ViicioService } from './viicio.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 segundos de timeout por padrão
      maxRedirects: 3,
    }),
    PrismaModule,
  ],
  controllers: [ViicioController],
  providers: [ViicioService],
  exports: [ViicioService], // Exportar para uso em outros módulos
})
export class ViicioModule {}