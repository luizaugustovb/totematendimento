import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { LoggerModule } from '../../core/logger/logger.module';

@Module({
  imports: [PrismaModule, LoggerModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}