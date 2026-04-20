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
import { PythonRunnerService } from './python-runner.service';
import {
  CreateScriptPythonDto,
  UpdateScriptPythonDto,
  ExecutarScriptDto,
  ScriptPythonResponseDto,
  ExecucaoPythonResponseDto,
  ResultadoExecucaoDto,
} from './dto/python-runner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Scripts Python')
@Controller('admin/scripts-python')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScriptsPythonController {
  constructor(private readonly pythonRunnerService: PythonRunnerService) {}

  @Post()
  @ApiOperation({
    summary: 'Cadastrar novo script Python',
    description: 'Cadastra um novo script Python no sistema com validações de segurança'
  })
  @ApiResponse({
    status: 201,
    description: 'Script cadastrado com sucesso',
    type: ScriptPythonResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou arquivo não encontrado'
  })
  async create(@Body() createScriptDto: CreateScriptPythonDto, @Request() req) {
    return this.pythonRunnerService.createScript(createScriptDto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar scripts Python',
    description: 'Retorna lista paginada de scripts cadastrados'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: 'Termo de busca' })
  @ApiResponse({
    status: 200,
    description: 'Lista de scripts retornada com sucesso'
  })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.pythonRunnerService.findAllScripts(pageNumber, limitNumber, search);
  }

  @Get('estatisticas')
  @ApiOperation({
    summary: 'Obter estatísticas das execuções',
    description: 'Retorna estatísticas gerais sobre execuções de scripts'
  })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas retornadas com sucesso'
  })
  async obterEstatisticas() {
    return this.pythonRunnerService.obterEstatisticasExecucoes();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter script por ID',
    description: 'Retorna dados completos de um script específico'
  })
  @ApiResponse({
    status: 200,
    description: 'Script encontrado',
    type: ScriptPythonResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Script não encontrado'
  })
  async findOne(@Param('id') id: string) {
    return this.pythonRunnerService.findOneScript(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar script',
    description: 'Atualiza dados de um script existente'
  })
  @ApiResponse({
    status: 200,
    description: 'Script atualizado com sucesso',
    type: ScriptPythonResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Script não encontrado'
  })
  async update(
    @Param('id') id: string,
    @Body() updateScriptDto: UpdateScriptPythonDto,
    @Request() req
  ) {
    return this.pythonRunnerService.updateScript(id, updateScriptDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Desativar script',
    description: 'Desativa um script em vez de excluí-lo'
  })
  @ApiResponse({
    status: 200,
    description: 'Script desativado com sucesso'
  })
  @ApiResponse({
    status: 404,
    description: 'Script não encontrado'
  })
  @ApiResponse({
    status: 400,
    description: 'Script possui execuções pendentes'
  })
  async remove(@Param('id') id: string, @Request() req) {
    return this.pythonRunnerService.removeScript(id, req.user.userId);
  }
}

@ApiTags('Execuções Python')
@Controller('admin/execucoes-python')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExecucoesPythonController {
  constructor(private readonly pythonRunnerService: PythonRunnerService) {}

  @Post('executar')
  @ApiOperation({
    summary: 'Executar script Python',
    description: 'Executa um script Python de forma assíncrona com parâmetros validados'
  })
  @ApiResponse({
    status: 201,
    description: 'Execução iniciada com sucesso',
    type: ResultadoExecucaoDto
  })
  @ApiResponse({
    status: 400,
    description: 'Parâmetros inválidos'
  })
  @ApiResponse({
    status: 404,
    description: 'Script não encontrado ou inativo'
  })
  async executar(@Body() executarDto: ExecutarScriptDto) {
    return this.pythonRunnerService.executarScript(executarDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar execuções',
    description: 'Retorna lista paginada de execuções de scripts'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página', example: 20 })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por status' })
  @ApiQuery({ name: 'scriptId', required: false, description: 'Filtrar por script' })
  @ApiResponse({
    status: 200,
    description: 'Lista de execuções retornada com sucesso'
  })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('scriptId') scriptId?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.pythonRunnerService.findAllExecucoes(pageNumber, limitNumber, status, scriptId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter execução por ID',
    description: 'Retorna dados completos de uma execução específica'
  })
  @ApiResponse({
    status: 200,
    description: 'Execução encontrada',
    type: ExecucaoPythonResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Execução não encontrada'
  })
  async findOne(@Param('id') id: string) {
    return this.pythonRunnerService.findOneExecucao(id);
  }

  @Post(':id/cancelar')
  @ApiOperation({
    summary: 'Cancelar execução',
    description: 'Cancela uma execução em andamento'
  })
  @ApiResponse({
    status: 200,
    description: 'Execução cancelada com sucesso'
  })
  @ApiResponse({
    status: 404,
    description: 'Execução não encontrada'
  })
  @ApiResponse({
    status: 400,
    description: 'Execução não pode ser cancelada no estado atual'
  })
  async cancelar(@Param('id') id: string, @Request() req) {
    return this.pythonRunnerService.cancelarExecucao(id, req.user.userId);
  }
}

// Controller público para execução automática (usado por outros módulos)
@ApiTags('Python Runner (Interno)')
@Controller('python-runner')
export class PythonRunnerController {
  constructor(private readonly pythonRunnerService: PythonRunnerService) {}

  @Post('executar-interno')
  @ApiOperation({
    summary: 'Executar script internamente',
    description: 'Endpoint interno para execução de scripts por outros módulos do sistema'
  })
  async executarInterno(@Body() executarDto: ExecutarScriptDto) {
    return this.pythonRunnerService.executarScript(executarDto);
  }
}