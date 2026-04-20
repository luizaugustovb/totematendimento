import { Module } from '@nestjs/common';
import { SinonimoExamesService } from './sinonimo-exames.service';
import { SinonimoExamesController, NormalizacaoPublicaController } from './sinonimo-exames.controller';

@Module({
  controllers: [SinonimoExamesController, NormalizacaoPublicaController],
  providers: [SinonimoExamesService],
  exports: [SinonimoExamesService],
})
export class SinonimoExamesModule {}