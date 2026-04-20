import { Module } from '@nestjs/common';
import { OcrComparisonController } from './ocr-comparison.controller';
import { OcrComparisonService } from './ocr-comparison.service';

@Module({
  controllers: [OcrComparisonController],
  providers: [OcrComparisonService],
  exports: [OcrComparisonService]
})
export class OcrComparisonModule {}
