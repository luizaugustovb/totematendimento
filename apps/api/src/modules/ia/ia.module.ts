import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { IAController } from './ia.controller';
import { IAService } from './ia.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000, // 60 segundos - IA pode demorar mais
      maxRedirects: 3,
    }),
    PrismaModule,
  ],
  controllers: [IAController],
  providers: [IAService],
  exports: [IAService], // Exportar para uso em outros módulos
})
export class IAModule {}