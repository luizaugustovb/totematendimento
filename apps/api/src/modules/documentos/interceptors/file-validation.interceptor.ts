import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import * as fileType from 'file-type';
import * as fs from 'fs/promises';

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Verificar se existe arquivo no request
    const file = request.file;
    const files = request.files;
    
    if (file) {
      await this.validateSingleFile(file);
    }
    
    if (files && Array.isArray(files)) {
      for (const f of files) {
        await this.validateSingleFile(f);
      }
    }
    
    return next.handle();
  }
  
  private async validateSingleFile(file: Express.Multer.File): Promise<void> {
    if (!file) return;
    
    try {
      // Verificar se o arquivo existe
      await fs.access(file.path);
      
      // Verificar tipo de arquivo real vs declarado
      const buffer = await fs.readFile(file.path);
      const fileTypeResult = await fileType.fromBuffer(buffer);
      
      if (fileTypeResult) {
        const realMimeType = fileTypeResult.mime;
        
        // Lista de tipos compatíveis
        const compatibleTypes: { [key: string]: string[] } = {
          'application/pdf': ['application/pdf'],
          'image/jpeg': ['image/jpeg', 'image/jpg'],
          'image/png': ['image/png'],
          'image/gif': ['image/gif'],
          'image/webp': ['image/webp'],
        };
        
        // Verificar se o tipo real é compatível com o declarado
        const declaredType = file.mimetype;
        const allowedTypes = compatibleTypes[declaredType] || [declaredType];
        
        if (!allowedTypes.includes(realMimeType)) {
          // Remover arquivo inválido
          await fs.unlink(file.path);
          throw new BadRequestException(
            `Arquivo com tipo inválido. Declarado: ${declaredType}, Real: ${realMimeType}`
          );
        }
      }
      
      // Verificação adicional de tamanho
      const stat = await fs.stat(file.path);
      const maxSize = 100 * 1024 * 1024; // 100MB
      
      if (stat.size > maxSize) {
        await fs.unlink(file.path);
        throw new BadRequestException('Arquivo muito grande. Máximo permitido: 100MB');
      }
      
      // Verificar se é um arquivo válido (não executável)
      const executableExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif'];
      const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      if (executableExtensions.includes(extension)) {
        await fs.unlink(file.path);
        throw new BadRequestException('Tipo de arquivo não permitido por segurança');
      }
      
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Erro inesperado - limpar arquivo
      try {
        await fs.unlink(file.path);
      } catch {}
      
      throw new BadRequestException('Erro na validação do arquivo');
    }
  }
}