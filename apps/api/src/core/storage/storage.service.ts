import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly uploadPath: string;
  private readonly tempPath: string;
  private readonly documentsPath: string;
  private readonly thumbnailsPath: string;
  
  constructor(private readonly config: ConfigService) {
    this.uploadPath = this.config.get('UPLOAD_PATH', './storage/uploads');
    this.tempPath = path.join(this.uploadPath, 'temp');
    this.documentsPath = path.join(this.uploadPath, 'documents');
    this.thumbnailsPath = path.join(this.uploadPath, 'thumbnails');
    
    this.ensureDirectories();
  }
  
  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.uploadPath,
      this.tempPath,
      this.documentsPath,
      this.thumbnailsPath,
    ];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }
  
  getUploadPath(): string {
    return this.uploadPath;
  }
  
  getTempPath(): string {
    return this.tempPath;
  }
  
  getDocumentsPath(): string {
    return this.documentsPath;
  }
  
  getThumbnailsPath(): string {
    return this.thumbnailsPath;
  }
  
  async getStorageUsage(): Promise<{
    total: number;
    used: number;
    available: number;
  }> {
    try {
      // Esta implementação é simples - em produção usar bibliotecas como 'df'
      const stats = await fs.stat(this.uploadPath);
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB (simulado)
        used: 10 * 1024 * 1024 * 1024,   // 10GB (simulado) 
        available: 90 * 1024 * 1024 * 1024, // 90GB (simulado)
      };
    } catch {
      return { total: 0, used: 0, available: 0 };
    }
  }
  
  async cleanTempFiles(): Promise<number> {
    try {
      const files = await fs.readdir(this.tempPath);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      let cleaned = 0;
      
      for (const file of files) {
        const filePath = path.join(this.tempPath, file);
        try {
          const stats = await fs.stat(filePath);
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch {
          // Arquivo pode ter sido removido por outro processo
        }
      }
      
      return cleaned;
    } catch {
      return 0;
    }
  }
}