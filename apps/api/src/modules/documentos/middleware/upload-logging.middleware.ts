import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../../../core/logger/logger.service';

@Injectable()
export class UploadLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}
  
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Capturar informações do usuário se existir
    const userId = (req as any).user?.id;
    
    // Override do método send para capturar response
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Log detalhado para uploads
      if (req.path.includes('upload')) {
        const files = req.file ? [req.file] : (req.files as Express.Multer.File[]) || [];
        
        // Informações dos arquivos
        const fileInfo = files.map(file => ({
          originalName: file?.originalname,
          filename: file?.filename,
          size: file?.size,
          mimetype: file?.mimetype,
        }));
        
        this.logger.info('File upload attempt', {
          userId,
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          filesCount: files.length,
          files: fileInfo,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          success: statusCode >= 200 && statusCode < 300,
        });
      }
      
      return originalSend.call(this, data);
    }.bind(this);
    
    next();
  }
}