import { Module } from '@nestjs/common';
import { ConveniosService } from './convenios.service';
import { ConveniosController } from './convenios.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConveniosController],
  providers: [ConveniosService],
  exports: [ConveniosService],
})
export class ConveniosModule {}