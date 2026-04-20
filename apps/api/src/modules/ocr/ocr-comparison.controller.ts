import { Controller, Post, Body, Logger } from '@nestjs/common';
import { OcrComparisonService } from './ocr-comparison.service';

@Controller('api/ocr')
export class OcrComparisonController {
  private readonly logger = new Logger(OcrComparisonController.name);

  constructor(private readonly ocrService: OcrComparisonService) {}

  @Post('aws-textract')
  async processarAWSTextract(@Body() body: { image: string }) {
    this.logger.log('🔍 Processando com AWS Textract');
    
    try {
      const resultado = await this.ocrService.processarAWSTextract(body.image);
      return {
        sucesso: true,
        ...resultado
      };
    } catch (erro) {
      this.logger.error('❌ Erro AWS Textract:', erro);
      return {
        sucesso: false,
        erro: erro.message
      };
    }
  }

  @Post('google-vision')
  async processarGoogleVision(@Body() body: { image: string }) {
    this.logger.log('🔍 Processando com Google Vision');
    
    try {
      const resultado = await this.ocrService.processarGoogleVision(body.image);
      return {
        sucesso: true,
        ...resultado
      };
    } catch (erro) {
      this.logger.error('❌ Erro Google Vision:', erro);
      return {
        sucesso: false,
        erro: erro.message
      };
    }
  }

  @Post('azure-vision')
  async processarAzureVision(@Body() body: { image: string }) {
    this.logger.log('🔍 Processando com Azure Computer Vision');
    
    try {
      const resultado = await this.ocrService.processarAzureVision(body.image);
      return {
        sucesso: true,
        ...resultado
      };
    } catch (erro) {
      this.logger.error('❌ Erro Azure Vision:', erro);
      return {
        sucesso: false,
        erro: erro.message
      };
    }
  }
}
