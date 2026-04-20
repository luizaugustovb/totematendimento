import { Module } from '@nestjs/common';
import { TotemController } from './totem.controller';
import { TotemService } from './totem.service';
import { SqlServerService } from './services/sql-server.service';
import { SyncLegadoService } from './services/sync-legado.service';
import { BuscaInteligenteService } from './services/busca-inteligente.service';
import { LogAuditoriaService } from './services/log-auditoria.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
// import { OCRModule } from '../ocr/ocr.module'; // Temporariamente desabilitado
import { StorageModule } from '../../core/storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    // OCRModule, // Temporariamente desabilitado
    StorageModule,
  ],
  controllers: [TotemController],
  providers: [TotemService, SqlServerService, SyncLegadoService, BuscaInteligenteService, LogAuditoriaService],
  exports: [TotemService, SqlServerService, SyncLegadoService, BuscaInteligenteService, LogAuditoriaService],
})
export class TotemModule {}