import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Res,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { QueryDocumentoDto } from './dto/query-documento.dto';
import { UploadResponseDto, MultiUploadResponseDto } from './dto/upload-response.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  // ============================================================================
  // UPLOAD DE ARQUIVOS
  // ============================================================================

  @Post('upload')
  @ApiOperation({ summary: 'Upload de um único arquivo' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201, 
    description: 'Arquivo enviado com sucesso',
    type: UploadResponseDto 
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body() createDocumentoDto: CreateDocumentoDto,
    @GetUser() user: User,
  ): Promise<UploadResponseDto> {
    return this.documentosService.uploadSingle(file, createDocumentoDto, user.id);
  }

  @Post('upload/multiple')
  @ApiOperation({ summary: 'Upload de múltiplos arquivos' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201,
    description: 'Arquivos enviados com sucesso',
    type: MultiUploadResponseDto 
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createDocumentoDto: CreateDocumentoDto,
    @GetUser() user: User,
  ): Promise<MultiUploadResponseDto> {
    return this.documentosService.uploadMultiple(files, createDocumentoDto, user.id);
  }

  @Post('upload/temp')
  @ApiOperation({ summary: 'Upload temporário para preview' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Upload temporário realizado' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemp(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    return this.documentosService.uploadTemp(file, user.id);
  }

  // ============================================================================
  // CRUD BÁSICO
  // ============================================================================

  @Get()
  @ApiOperation({ summary: 'Listar documentos do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de documentos' })
  async findAll(
    @Query() queryDto: QueryDocumentoDto,
    @GetUser() user: User,
  ) {
    return this.documentosService.findAll(queryDto, user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Busca avançada de documentos' })
  @ApiQuery({ name: 'q', description: 'Termo de busca' })
  @ApiResponse({ status: 200, description: 'Resultados da busca' })
  async search(
    @Query('q') searchTerm: string,
    @Query() queryDto: QueryDocumentoDto,
    @GetUser() user: User,
  ) {
    return this.documentosService.search(searchTerm, queryDto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter documento por ID' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Documento encontrado' })
  @ApiResponse({ status: 404, description: 'Documento não encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.documentosService.findOne(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar documento' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Documento atualizado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDocumentoDto,
    @GetUser() user: User,
  ) {
    return this.documentosService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir documento' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Documento excluído' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.documentosService.remove(id, user.id);
  }

  // ============================================================================
  // DOWNLOAD E VISUALIZAÇÃO
  // ============================================================================

  @Get(':id/download')
  @ApiOperation({ summary: 'Download do arquivo original' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Arquivo para download' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    return this.documentosService.download(id, user.id, res);
  }

  @Get(':id/thumbnail')
  @ApiOperation({ summary: 'Obter thumbnail do documento' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Imagem thumbnail' })
  async getThumbnail(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    return this.documentosService.getThumbnail(id, user.id, res);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview do documento (imagem ou PDF)' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Preview do documento' })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    return this.documentosService.preview(id, user.id, res);
  }

  // ============================================================================
  // PROCESSAMENTO E IA
  // ============================================================================

  @Post(':id/process')
  @ApiOperation({ summary: 'Iniciar processamento com IA' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Processamento iniciado' })
  async processWithIA(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('opcoes') opcoes: any,
    @GetUser() user: User,
  ) {
    return this.documentosService.processWithIA(id, opcoes, user.id);
  }

  @Get(':id/processing-status')
  @ApiOperation({ summary: 'Status do processamento' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Status do processamento' })
  async getProcessingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.documentosService.getProcessingStatus(id, user.id);
  }

  @Get(':id/extracted-text')
  @ApiOperation({ summary: 'Obter texto extraído do documento' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Texto extraído' })
  async getExtractedText(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.documentosService.getExtractedText(id, user.id);
  }

  // ============================================================================
  // ESTATÍSTICAS E RELATÓRIOS
  // ============================================================================

  @Get('stats/overview')
  @ApiOperation({ summary: 'Estatísticas gerais dos documentos' })
  @ApiResponse({ status: 200, description: 'Estatísticas dos documentos' })
  async getStats(@GetUser() user: User) {
    return this.documentosService.getStats(user.id);
  }

  @Get('stats/storage')
  @ApiOperation({ summary: 'Informações de armazenamento' })
  @ApiResponse({ status: 200, description: 'Estatísticas de armazenamento' })
  async getStorageStats(@GetUser() user: User) {
    return this.documentosService.getStorageStats(user.id);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Documentos recentes' })
  @ApiQuery({ name: 'limite', description: 'Número de documentos', required: false })
  @ApiResponse({ status: 200, description: 'Documentos recentes' })
  async getRecent(
    @Query('limite') limite: number = 10,
    @GetUser() user: User,
  ) {
    return this.documentosService.getRecent(limite, user.id);
  }

  // ============================================================================
  // ORGANIZAÇÃO
  // ============================================================================

  @Post(':id/organize')
  @ApiOperation({ summary: 'Organizar documento automaticamente' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Documento organizado' })
  async organize(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.documentosService.organize(id, user.id);
  }

  @Put(':id/tags')
  @ApiOperation({ summary: 'Atualizar tags do documento' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Tags atualizadas' })
  async updateTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('tags') tags: string[],
    @GetUser() user: User,
  ) {
    return this.documentosService.updateTags(id, tags, user.id);
  }

  // ============================================================================
  // COMPARTILHAMENTO (FUTURO)
  // ============================================================================

  @Post(':id/share')
  @ApiOperation({ summary: 'Compartilhar documento (temporário)' })
  @ApiParam({ name: 'id', description: 'ID do documento' })
  @ApiResponse({ status: 200, description: 'Link de compartilhamento gerado' })
  async share(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('expiresIn') expiresIn: number = 24, // horas
    @GetUser() user: User,
  ) {
    return this.documentosService.generateShareLink(id, expiresIn, user.id);
  }
}