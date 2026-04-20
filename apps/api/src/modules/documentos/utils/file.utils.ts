import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

export class FileUtils {
  /**
   * Gera um hash SHA256 para um arquivo
   */
  static async generateFileHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  
  /**
   * Gera nome único para arquivo
   */
  static generateUniqueFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    return `${Date.now()}-${uniqueSuffix}${ext}`;
  }
  
  /**
   * Verifica se o arquivo é uma imagem
   */
  static isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }
  
  /**
   * Verifica se o arquivo é um PDF
   */
  static isPdfFile(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }
  
  /**
   * Verifica se o arquivo permite geração de thumbnail
   */
  static canGenerateThumbnail(mimeType: string): boolean {
    return this.isImageFile(mimeType) || this.isPdfFile(mimeType);
  }
  
  /**
   * Verifica se o arquivo permite extração de texto
   */
  static canExtractText(mimeType: string): boolean {
    return this.isPdfFile(mimeType) || mimeType === 'text/plain';
  }
  
  /**
   * Formatar tamanho de arquivo em formato legível
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Obter extensão do arquivo
   */
  static getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }
  
  /**
   * Obter nome sem extensão
   */
  static getFileNameWithoutExtension(filename: string): string {
    return path.basename(filename, path.extname(filename));
  }
  
  /**
   * Validar nome de arquivo (sem caracteres especiais)
   */
  static isValidFileName(filename: string): boolean {
    const invalidChars = /[<>:"/\\|?*]/;
    return !invalidChars.test(filename) && filename.length <= 255;
  }
  
  /**
   * Sanitizar nome de arquivo
   */
  static sanitizeFileName(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }
  
  /**
   * Verificar se arquivo existe
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Obter informações do arquivo
   */
  static async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size: number;
    modified: Date;
    created: Date;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
      };
    } catch {
      return {
        exists: false,
        size: 0,
        modified: new Date(0),
        created: new Date(0),
      };
    }
  }
  
  /**
   * Criar diretório se não existir
   */
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignorar se diretório já existe
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Obter tipo MIME baseado na extensão
   */
  static getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}