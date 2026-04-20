import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SinonimoExamesService } from './sinonimo-exames.service';
import {
  CreateSinonimoExameDto,
  UpdateSinonimoExameDto,
  SinonimoExameResponseDto,
  NormalizarExameDto,
  ResultadoNormalizacaoDto,
} from './dto/sinonimo-exames.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Sinônimos de Exames')
@Controller('admin/sinonimo-exames')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SinonimoExamesController {
  constructor(private readonly sinonimoExamesService: SinonimoExamesService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar novo sinônimo',
    description: 'Cadastra um novo sinônimo para um exame'
  })
  @ApiResponse({
    status: 201,
    description: 'Sinônimo criado com sucesso',
    type: SinonimoExameResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou sinônimo já existe'
  })
  async create(@Body() createSinonimoDto: CreateSinonimoExameDto, @Request() req) {
    return this.sinonimoExamesService.create(createSinonimoDto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar sinônimos',
    description: 'Retorna lista paginada de sinônimos'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: 'Termo de busca' })
  @ApiQuery({ name: 'exameId', required: false, description: 'Filtrar por exame específico' })
  @ApiResponse({
    status: 200,
    description: 'Lista de sinônimos retornada com sucesso'
  })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('exameId') exameId?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.sinonimoExamesService.findAll(pageNumber, limitNumber, search, exameId);
  }

  @Get('estatisticas')
  @ApiOperation({
    summary: 'Obter estatísticas dos sinônimos',
    description: 'Retorna estatísticas gerais sobre os sinônimos cadastrados'
  })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas retornadas com sucesso'
  })
  async obterEstatisticas() {
    return this.sinonimoExamesService.obterEstatisticas();
  }

  @Post('normalizar')
  @ApiOperation({
    summary: 'Normalizar nome de exame',
    description: 'NÚCLEO DO SISTEMA: Normaliza um texto de exame usando todas as estratégias de matching'
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado da normalização',
    type: ResultadoNormalizacaoDto
  })
  async normalizarExame(@Body() normalizarDto: NormalizarExameDto) {
    return this.sinonimoExamesService.normalizarExame(normalizarDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter sinônimo por ID',
    description: 'Retorna dados completos de um sinônimo específico'
  })
  @ApiResponse({
    status: 200,
    description: 'Sinônimo encontrado',
    type: SinonimoExameResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Sinônimo não encontrado'
  })
  async findOne(@Param('id') id: string) {
    return this.sinonimoExamesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar sinônimo',
    description: 'Atualiza dados de um sinônimo existente'
  })
  @ApiResponse({
    status: 200,
    description: 'Sinônimo atualizado com sucesso',
    type: SinonimoExameResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Sinônimo não encontrado'
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos'
  })
  async update(
    @Param('id') id: string,
    @Body() updateSinonimoDto: UpdateSinonimoExameDto,
    @Request() req
  ) {
    return this.sinonimoExamesService.update(id, updateSinonimoDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Excluir sinônimo',
    description: 'Remove um sinônimo do sistema'
  })
  @ApiResponse({
    status: 200,
    description: 'Sinônimo excluído com sucesso'
  })
  @ApiResponse({
    status: 404,
    description: 'Sinônimo não encontrado'
  })
  async remove(@Param('id') id: string, @Request() req) {
    return this.sinonimoExamesService.remove(id, req.user.userId);
  }
}

// Controller público para normalização (usado pelo totem)
@ApiTags('Normalização de Exames (Público)')
@Controller('normalizar')
export class NormalizacaoPublicaController {
  constructor(private readonly sinonimoExamesService: SinonimoExamesService) {}

  @Post('exame')
  @ApiOperation({
    summary: 'Normalizar exame (Público)',
    description: 'Endpoint público para normalização de exames usado pelo totem'
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado da normalização',
    type: ResultadoNormalizacaoDto
  })
  async normalizarExame(@Body() normalizarDto: NormalizarExameDto) {
    return this.sinonimoExamesService.normalizarExame(normalizarDto);
  }
}