import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  Query,
  Request,
  UseGuards,
  Logger,
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { IntegrationService } from './integration.service';
import { IntegrationGateway } from './integration.gateway';
import { integrationConfig } from '../../core/config/integration.config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs/promises';

interface UploadRequestBody {
  pedidoId?: number;
  convenioId?: number;
  unidadeId?: number;
  tipoDocumento?: string;
  observacoes?: string;
}

interface UploadResult {
  success: boolean;
  files: {
    originalName: string;
    fileName: string;
    size: number;
    mimeType: string;
    path: string;
  }[];
  pedidoId?: number;
  message: string;
}

@ApiTags('Integration - Upload')
@ApiBearerAuth()
@Controller('integration/upload')
@UseGuards(JwtAuthGuard)
export class IntegrationUploadController {
  private readonly logger = new Logger(IntegrationUploadController.name);

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly integrationGateway: IntegrationGateway,
  ) {}

  // Single file upload
  @Post('single')
  @ApiOperation({ summary: 'Upload single document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201, 
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        file: {
          type: 'object',
          properties: {
            originalName: { type: 'string' },
            fileName: { type: 'string' },
            size: { type: 'number' },
            mimeType: { type: 'string' },
            path: { type: 'string' }
          }
        },
        message: { type: 'string' }
      }
    }
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'storage', 'uploads', 
            new Date().getFullYear().toString(),
            (new Date().getMonth() + 1).toString().padStart(2, '0')
          );
          
          // Ensure directory exists
          fs.mkdir(uploadPath, { recursive: true }).then(() => {
            cb(null, uploadPath);
          }).catch(err => {
            cb(err, uploadPath);
          });
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: integrationConfig.upload.maxFileSize * 1024 * 1024, // MB to bytes
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = integrationConfig.upload.allowedMimeTypes;
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new UnsupportedMediaTypeException(
            `File type ${file.mimetype} not allowed. Allowed types: ${allowedMimes.join(', ')}`
          ), false);
        }
      },
    })
  )
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadRequestBody,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      const uploadResult = {
        success: true,
        file: {
          originalName: file.originalname,
          fileName: file.filename,
          size: file.size,
          mimeType: file.mimetype,
          path: file.path,
        },
        message: 'File uploaded successfully',
      };

      // Log upload activity
      await this.integrationService.logSystemEvent('FILE_UPLOADED', {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId: req.user?.id,
        ...body,
      });

      // Broadcast upload notification
      this.integrationGateway.broadcastActivity({
        type: 'upload',
        description: `Documento enviado: ${file.originalname}`,
        user: req.user?.nome || 'Usuario',
        timestamp: new Date().toISOString(),
        metadata: {
          fileName: file.originalname,
          fileSize: this.formatBytes(file.size),
          fileType: file.mimetype,
        }
      });

      this.logger.log(`File uploaded successfully: ${file.originalname} by user ${req.user?.id}`);
      
      return uploadResult;
    } catch (error) {
      this.logger.error(`Error uploading file ${file.originalname}:`, error);
      
      // Clean up uploaded file on error
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        this.logger.error('Failed to clean up uploaded file:', unlinkError);
      }

      throw new BadRequestException('Failed to process uploaded file');
    }
  }

  // Multiple files upload
  @Post('multiple')
  @ApiOperation({ summary: 'Upload multiple documents' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201, 
    description: 'Files uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              originalName: { type: 'string' },
              fileName: { type: 'string' },
              size: { type: 'number' },
              mimeType: { type: 'string' },
              path: { type: 'string' }
            }
          }
        },
        totalSize: { type: 'number' },
        message: { type: 'string' }
      }
    }
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, { // Max 10 files
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'storage', 'uploads', 
            new Date().getFullYear().toString(),
            (new Date().getMonth() + 1).toString().padStart(2, '0')
          );
          
          // Ensure directory exists
          fs.mkdir(uploadPath, { recursive: true }).then(() => {
            cb(null, uploadPath);
          }).catch(err => {
            cb(err, uploadPath);
          });
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: integrationConfig.upload.maxFileSize * 1024 * 1024, // MB to bytes
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = integrationConfig.upload.allowedMimeTypes;
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new UnsupportedMediaTypeException(
            `File type ${file.mimetype} not allowed. Allowed types: ${allowedMimes.join(', ')}`
          ), false);
        }
      },
    })
  )
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadRequestBody,
    @Request() req: any,
  ): Promise<UploadResult> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const uploadedFiles = [];
    let totalSize = 0;
    const failedFiles = [];

    try {
      for (const file of files) {
        try {
          uploadedFiles.push({
            originalName: file.originalname,
            fileName: file.filename,
            size: file.size,
            mimeType: file.mimetype,
            path: file.path,
          });
          totalSize += file.size;
        } catch (fileError) {
          this.logger.error(`Error processing file ${file.originalname}:`, fileError);
          failedFiles.push(file.originalname);
          
          // Clean up failed file
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            this.logger.error('Failed to clean up failed file:', unlinkError);
          }
        }
      }

      // Log upload activity
      await this.integrationService.logSystemEvent('MULTIPLE_FILES_UPLOADED', {
        filesCount: uploadedFiles.length,
        totalSize,
        failedFiles,
        userId: req.user?.id,
        ...body,
      });

      // Broadcast upload notification
      this.integrationGateway.broadcastActivity({
        type: 'upload',
        description: `${uploadedFiles.length} documentos enviados`,
        user: req.user?.nome || 'Usuario',
        timestamp: new Date().toISOString(),
        metadata: {
          filesCount: uploadedFiles.length,
          totalSize: this.formatBytes(totalSize),
          failedFiles,
        }
      });

      const result: UploadResult = {
        success: uploadedFiles.length > 0,
        files: uploadedFiles,
        message: failedFiles.length > 0 
          ? `${uploadedFiles.length} files uploaded successfully, ${failedFiles.length} failed`
          : `${uploadedFiles.length} files uploaded successfully`,
      };

      this.logger.log(`Multiple files upload completed: ${uploadedFiles.length} success, ${failedFiles.length} failed`);
      
      return result;
    } catch (error) {
      this.logger.error('Error in multiple file upload:', error);
      
      // Clean up all uploaded files on major error
      for (const file of files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          this.logger.error('Failed to clean up uploaded file:', unlinkError);
        }
      }

      throw new BadRequestException('Failed to process uploaded files');
    }
  }

  // Check upload progress (for large files)
  @Post('progress')
  @ApiOperation({ summary: 'Check upload progress' })
  @ApiResponse({ status: 200, description: 'Upload progress information' })
  async checkProgress(
    @Query('sessionId') sessionId: string,
  ) {
    // This would be implemented with a progress tracking system
    // For now, returning a mock response
    return {
      sessionId,
      progress: 100,
      status: 'completed',
      message: 'Upload completed successfully',
    };
  }

  // Delete uploaded file
  @Post('delete')
  @ApiOperation({ summary: 'Delete uploaded file' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(
    @Body('filePath') filePath: string,
    @Request() req: any,
  ) {
    try {
      // Validate file path (security check)
      const normalizedPath = join(process.cwd(), 'storage', 'uploads');
      if (!filePath.startsWith(normalizedPath)) {
        throw new BadRequestException('Invalid file path');
      }

      await fs.unlink(filePath);

      // Log deletion activity
      await this.integrationService.logSystemEvent('FILE_DELETED', {
        filePath,
        userId: req.user?.id,
      });

      this.logger.log(`File deleted: ${filePath} by user ${req.user?.id}`);

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}:`, error);
      throw new BadRequestException('Failed to delete file');
    }
  }

  // Helper method to format bytes
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}