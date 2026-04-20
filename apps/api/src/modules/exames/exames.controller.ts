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
import { ExamesService } from './exames.service';
import { CreateExameDto, UpdateExameDto, ExameResponseDto } from './dto/exames.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Exames')
@Controller('admin/exames')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExamesController {
  constructor(private readonly examesService: ExamesService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar novo exame',
    description: 'Cadastra um novo exame no sistema'
  })
  @ApiResponse({
    status: 201,
    description: 'Exame criado com sucesso',
    type: ExameResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou exame já existe'
  })
  async create(@Body() createExameDto: CreateExameDto, @Request() req) {
    return this.examesService.create(createExameDto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar exames',
    description: 'Retorna lista paginada de exames'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: 'Termo de busca' })
  @ApiResponse({
    status: 200,
    description: 'Lista de exames retornada com sucesso'
  })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.examesService.findAll(pageNumber, limitNumber, search);
  }

  @Get('buscar')
  @ApiOperation({
    summary: 'Buscar exames por texto',
    description: 'Busca fuzzy em nomes de exames e sinônimos'
  })
  @ApiQuery({ name: 'texto', required: true, description: 'Texto para busca' })
  @ApiResponse({
    status: 200,
    description: 'Resultados da busca retornados'
  })
  async buscarPorTexto(@Query('texto') texto: string) {
    return this.examesService.buscarPorTexto(texto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter exame por ID',
    description: 'Retorna dados completos de um exame específico'
  })
  @ApiResponse({
    status: 200,
    description: 'Exame encontrado',
    type: ExameResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Exame não encontrado'
  })
  async findOne(@Param('id') id: string) {
    return this.examesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar exame',
    description: 'Atualiza dados de um exame existente'
  })
  @ApiResponse({
    status: 200,
    description: 'Exame atualizado com sucesso',
    type: ExameResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Exame não encontrado'
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos'
  })
  async update(
    @Param('id') id: string,
    @Body() updateExameDto: UpdateExameDto,
    @Request() req
  ) {
    return this.examesService.update(id, updateExameDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Desativar exame',
    description: 'Desativa um exame em vez de excluí-lo'
  })
  @ApiResponse({
    status: 200,
    description: 'Exame desativado com sucesso'
  })
  @ApiResponse({
    status: 404,
    description: 'Exame não encontrado'
  })
  @ApiResponse({
    status: 400,
    description: 'Exame possui atendimentos vinculados'
  })
  async remove(@Param('id') id: string, @Request() req) {
    return this.examesService.remove(id, req.user.userId);
  }

  @Patch(':id/ativar')
  @ApiOperation({
    summary: 'Reativar exame',
    description: 'Reativa um exame desativado'
  })
  @ApiResponse({
    status: 200,
    description: 'Exame reativado com sucesso'
  })
  @ApiResponse({
    status: 404,
    description: 'Exame não encontrado'
  })
  async activate(@Param('id') id: string, @Request() req) {
    return this.examesService.activate(id, req.user.userId);
  }
}