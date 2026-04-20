import { MulterModuleOptions } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';

export const multerConfig = (configService: ConfigService): MulterModuleOptions => {
  // Criar diretórios se não existirem
  const uploadPath = configService.get('UPLOAD_PATH', './storage/uploads');
  const tempPath = join(uploadPath, 'temp');
  const docsPath = join(uploadPath, 'documents');
  
  [uploadPath, tempPath, docsPath].forEach(path => {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }
  });

  return {
    storage: diskStorage({
      destination: (req: Request, file: Express.Multer.File, cb) => {
        // Determinar pasta baseado no tipo de arquivo
        const isTemp = req.path.includes('/temp');
        const targetPath = isTemp ? tempPath : docsPath;
        cb(null, targetPath);
      },
      filename: (req: Request, file: Express.Multer.File, cb) => {
        // Gerar nome único
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = extname(file.originalname);
        const filename = `${Date.now()}-${uniqueSuffix}${ext}`;
        cb(null, filename);
      },
    }),
    fileFilter: (req: Request, file: Express.Multer.File, cb) => {
      // Tipos de arquivo permitidos
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Tipo de arquivo não suportado: ${file.mimetype}`), false);
      }
    },
    limits: {
      fileSize: parseInt(configService.get('MAX_FILE_SIZE', '104857600')), // 100MB default
      files: parseInt(configService.get('MAX_FILES_PER_UPLOAD', '5')), // 5 arquivos por upload
    },
  };
};