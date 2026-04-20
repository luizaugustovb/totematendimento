import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { OCRController } from './ocr.controller';
import { OCRService } from './ocr.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB - mesmo limite do serviço
      },
      fileFilter: (req, file, callback) => {
        // Aceitar apenas imagens e PDFs
        const allowedTypes = [
          'image/jpeg',
          'image/png', 
          'image/webp',
          'image/tiff',
          'application/pdf'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`), false);
        }
      },
    }),
    PrismaModule,
  ],
  controllers: [OCRController],
  providers: [OCRService],
  exports: [OCRService], // Exportar para uso em outros módulos
})
export class OCRModule {}