import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IA_QUEUE, DOCUMENT_QUEUE, REPORT_QUEUE, EMAIL_QUEUE } from '../core/constants/queues';
import { IaProcessor } from './processors/ia.processor';
import { DocumentProcessor } from './processors/document.processor';
import { ReportProcessor } from './processors/report.processor';
import { EmailProcessor } from './processors/email.processor';
import { WorkerService } from './worker.service';
import { PrismaModule } from '../core/database/prisma.module';
import { LoggerModule } from '../core/logger/logger.module';
import { RedisModule } from '../core/redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LoggerModule,
    RedisModule,
    BullModule.registerQueueAsync({
      name: IA_QUEUE,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: false,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
        settings: {
          stalledInterval: 30 * 1000,
          maxStalledCount: 1,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: DOCUMENT_QUEUE,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: REPORT_QUEUE,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 3,
          attempts: 2,
          delay: 5000, // 5 segundos de delay para relatórios
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: EMAIL_QUEUE,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: 10,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    WorkerService,
    IaProcessor,
    DocumentProcessor,
    ReportProcessor,
    EmailProcessor,
  ],
  exports: [WorkerService, BullModule],
})
export class WorkersModule {}