import { 
  Controller, 
  Post, 
  Body, 
  Get,
  HttpException, 
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TotemService } from './totem.service';
import { SqlServerService } from './services/sql-server.service';
import { BuscaInteligenteService } from './services/busca-inteligente.service';
import { SyncLegadoService } from './services/sync-legado.service';
import { LogAuditoriaService } from './services/log-auditoria.service';
import {
  ProcessarDocumentoDto,
  ConsultaClienteResponseDto,
  ProcessarCarteirinhaDto,
  SalvarAtendimentoDto,
  SalvarAtendimentoResponseDto,
} from './dto/totem.dto';
import {
  BuscarExamesDto,
  BuscarMedicosDto,
  SugerirExamesDto,
  AdicionarSinonimoDto,
  RemoverSinonimoDto,
  SincronizarManualDto,
  RegistrarLogDto,
  BuscarLogsDto,
} from './dto/busca.dto';

@ApiTags('Totem - Autoatendimento')
@Controller('totem')
export class TotemController {
  private readonly logger = new Logger(TotemController.name);

  constructor(
    private readonly totemService: TotemService,
    private readonly sqlServerService: SqlServerService,
    private readonly buscaInteligenteService: BuscaInteligenteService,
    private readonly syncLegadoService: SyncLegadoService,
    private readonly logAuditoriaService: LogAuditoriaService,
  ) {}

  /**
   * Endpoint para processar documento (CNH/RG) com OCR
   * e consultar cliente no banco SQL Server
   */
  @Post('processar-documento')
  @ApiOperation({ 
    summary: 'Processar documento CNH/RG com OCR e consultar cliente',
    description: 'Extrai dados do documento via OCR e consulta cliente no SQL Server por CPF'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Documento processado com sucesso',
    type: ConsultaClienteResponseDto
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 500, description: 'Erro ao processar documento' })
  async processarDocumento(
    @Body() dto: ProcessarDocumentoDto
  ): Promise<ConsultaClienteResponseDto> {
    try {
      this.logger.log('Requisição para processar documento');
      
      const resultado = await this.totemService.processarDocumento(dto);
      
      return resultado;
      
    } catch (error) {
      this.logger.error('Erro ao processar documento', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao processar documento',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint para processar carteirinha de convênio com OCR
   */
  @Post('processar-carteirinha')
  @ApiOperation({ 
    summary: 'Processar carteirinha de convênio com OCR',
    description: 'Extrai dados da carteirinha do convênio via OCR'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Carteirinha processada com sucesso'
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 500, description: 'Erro ao processar carteirinha' })
  async processarCarteirinha(
    @Body() dto: ProcessarCarteirinhaDto
  ) {
    try {
      this.logger.log('Requisição para processar carteirinha');
      
      const resultado = await this.totemService.processarCarteirinha(dto);
      
      return resultado;
      
    } catch (error) {
      this.logger.error('Erro ao processar carteirinha', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao processar carteirinha',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint para salvar atendimento completo
   */
  @Post('salvar-atendimento')
  @ApiOperation({ 
    summary: 'Salvar atendimento completo',
    description: 'Salva todos os dados do atendimento: cliente, documentos, carteirinha e guias'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Atendimento salvo com sucesso',
    type: SalvarAtendimentoResponseDto
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 500, description: 'Erro ao salvar atendimento' })
  async salvarAtendimento(
    @Body() dto: SalvarAtendimentoDto
  ): Promise<SalvarAtendimentoResponseDto> {
    try {
      this.logger.log('Requisição para salvar atendimento');
      
      const resultado = await this.totemService.salvarAtendimento(dto);
      
      return resultado;
      
    } catch (error) {
      this.logger.error('Erro ao salvar atendimento', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erro ao salvar atendimento',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint de teste de conexão com SQL Server
   */
  @Get('teste-sql-server')
  @ApiOperation({ 
    summary: 'Testar conexão com SQL Server',
    description: 'Verifica se a conexão com o banco SQL Server está funcionando'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Conexão testada'
  })
  async testarSQLServer() {
    try {
      this.logger.log('Testando conexão SQL Server');
      
      const conectado = await this.sqlServerService.testarConexao();
      
      return {
        success: conectado,
        mensagem: conectado 
          ? 'Conexão com SQL Server estabelecida com sucesso' 
          : 'Falha ao conectar com SQL Server',
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      this.logger.error('Erro ao testar conexão SQL Server', error);
      return {
        success: false,
        mensagem: 'Erro ao testar conexão',
        erro: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Endpoint de health check
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Health check do módulo de totem',
    description: 'Verifica se o módulo de totem está funcionando'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Módulo funcionando'
  })
  async healthCheck() {
    return {
      status: 'ok',
      modulo: 'totem',
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // BUSCA INTELIGENTE - EXAMES
  // ==========================================

  /**
   * Busca exames com OCR inteligente (normalização + sinônimos + fuzzy)
   */
  @Post('exames/buscar')
  @ApiOperation({ 
    summary: 'Buscar exames por texto OCR',
    description: 'Busca inteligente com normalização, sinônimos e matching fuzzy'
  })
  @ApiResponse({ status: 200, description: 'Exames encontrados' })
  async buscarExames(@Body() dto: BuscarExamesDto) {
    try {
      const resultados = await this.buscaInteligenteService.buscarExames(
        dto.textoOcr,
        dto.limit
      );

      return {
        success: true,
        total: resultados.length,
        exames: resultados,
      };
    } catch (error) {
      this.logger.error('Erro ao buscar exames', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao buscar exames',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Sugerir exames quando não encontrado
   */
  @Post('exames/sugerir')
  @ApiOperation({ 
    summary: 'Sugerir exames similares',
    description: 'Retorna sugestões de exames quando não encontra match exato'
  })
  @ApiResponse({ status: 200, description: 'Sugestões retornadas' })
  async sugerirExames(@Body() dto: SugerirExamesDto) {
    try {
      const sugestoes = await this.buscaInteligenteService.sugerirExames(
        dto.textoOcr,
        dto.limit
      );

      return {
        success: true,
        total: sugestoes.length,
        sugestoes,
      };
    } catch (error) {
      this.logger.error('Erro ao sugerir exames', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao sugerir exames',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Listar todos os exames cadastrados
   */
  @Get('exames')
  @ApiOperation({ 
    summary: 'Listar todos os exames',
    description: 'Retorna lista paginada de exames cadastrados'
  })
  @ApiResponse({ status: 200, description: 'Lista de exames' })
  async listarExames() {
    try {
      const exames = await this.totemService.listarExames();

      return {
        success: true,
        total: exames.length,
        exames,
      };
    } catch (error) {
      this.logger.error('Erro ao listar exames', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao listar exames',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================
  // BUSCA INTELIGENTE - MÉDICOS
  // ==========================================

  /**
   * Buscar médicos por nome, CRM ou UF
   */
  @Post('medicos/buscar')
  @ApiOperation({ 
    summary: 'Buscar médicos',
    description: 'Busca médicos por nome, CRM e/ou UF'
  })
  @ApiResponse({ status: 200, description: 'Médicos encontrados' })
  async buscarMedicos(@Body() dto: BuscarMedicosDto) {
    try {
      const resultados = await this.buscaInteligenteService.buscarMedicos(
        dto.nome,
        dto.crm,
        dto.uf,
        dto.limit
      );

      return {
        success: true,
        total: resultados.length,
        medicos: resultados,
      };
    } catch (error) {
      this.logger.error('Erro ao buscar médicos', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao buscar médicos',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Listar todos os médicos cadastrados
   */
  @Get('medicos')
  @ApiOperation({ 
    summary: 'Listar todos os médicos',
    description: 'Retorna lista de médicos cadastrados'
  })
  @ApiResponse({ status: 200, description: 'Lista de médicos' })
  async listarMedicos() {
    try {
      const medicos = await this.totemService.listarMedicos();

      return {
        success: true,
        total: medicos.length,
        medicos,
      };
    } catch (error) {
      this.logger.error('Erro ao listar médicos', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao listar médicos',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================
  // SINÔNIMOS
  // ==========================================

  /**
   * Adicionar sinônimo de exame
   */
  @Post('sinonimos')
  @ApiOperation({ 
    summary: 'Adicionar sinônimo de exame',
    description: 'Cria novo sinônimo para melhorar matching OCR'
  })
  @ApiResponse({ status: 201, description: 'Sinônimo criado' })
  async adicionarSinonimo(@Body() dto: AdicionarSinonimoDto) {
    try {
      const sinonimo = await this.buscaInteligenteService.adicionarSinonimo(
        dto.exameId,
        dto.descricaoVariacao,
        dto.criadoPorUsuarioId,
        dto.medicoId,
        dto.convenioId,
      );

      return {
        success: true,
        mensagem: 'Sinônimo adicionado com sucesso',
        sinonimo,
      };
    } catch (error) {
      this.logger.error('Erro ao adicionar sinônimo', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao adicionar sinônimo',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Listar sinônimos de um exame
   */
  @Get('sinonimos/:exameId')
  @ApiOperation({ 
    summary: 'Listar sinônimos de um exame',
    description: 'Retorna todos os sinônimos cadastrados para um exame'
  })
  @ApiResponse({ status: 200, description: 'Lista de sinônimos' })
  async listarSinonimos(@Body('exameId') exameId: string) {
    try {
      const sinonimos = await this.buscaInteligenteService.listarSinonimosExame(exameId);

      return {
        success: true,
        total: sinonimos.length,
        sinonimos,
      };
    } catch (error) {
      this.logger.error('Erro ao listar sinônimos', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao listar sinônimos',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Remover sinônimo
   */
  @Post('sinonimos/remover')
  @ApiOperation({ 
    summary: 'Remover sinônimo',
    description: 'Desativa um sinônimo (soft delete)'
  })
  @ApiResponse({ status: 200, description: 'Sinônimo removido' })
  async removerSinonimo(@Body() dto: RemoverSinonimoDto) {
    try {
      await this.buscaInteligenteService.removerSinonimo(dto.sinonimoId);

      return {
        success: true,
        mensagem: 'Sinônimo removido com sucesso',
      };
    } catch (error) {
      this.logger.error('Erro ao remover sinônimo', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao remover sinônimo',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================
  // SINCRONIZAÇÃO LEGACY
  // ==========================================

  /**
   * Trigger manual de sincronização
   */
  @Post('sync/manual')
  @ApiOperation({ 
    summary: 'Sincronização manual SQL Server',
    description: 'Trigger manual para sincronizar exames e/ou médicos'
  })
  @ApiResponse({ status: 200, description: 'Sincronização iniciada' })
  async sincronizarManual(@Body() dto: SincronizarManualDto) {
    try {
      await this.syncLegadoService.sincronizarManual(dto.tipo);

      return {
        success: true,
        mensagem: `Sincronização de ${dto.tipo} iniciada com sucesso`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao sincronizar manualmente', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao iniciar sincronização',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Status da sincronização
   */
  @Get('sync/status')
  @ApiOperation({ 
    summary: 'Status da sincronização',
    description: 'Retorna estatísticas e status da sincronização automática'
  })
  @ApiResponse({ status: 200, description: 'Status da sincronização' })
  async statusSincronizacao() {
    try {
      const status = await this.syncLegadoService.obterStatus();

      return {
        success: true,
        ...status,
      };
    } catch (error) {
      this.logger.error('Erro ao obter status de sincronização', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao obter status',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Status da sincronização
   */
  @Get('sync/status')
  @ApiOperation({ 
    summary: 'Status da sincronização',
    description: 'Retorna status e estatísticas da sincronização'
  })
  @ApiResponse({ status: 200, description: 'Status recuperado' })
  async statusSync() {
    try {
      const status = await this.syncLegadoService.obterStatus();

      return {
        success: true,
        ...status,
      };
    } catch (error) {
      this.logger.error('Erro ao obter status', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao obter status da sincronização',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================
  // LOGS DE AUDITORIA
  // ==========================================

  /**
   * Registrar log de auditoria
   */
  @Post('logs/auditoria')
  @ApiOperation({ 
    summary: 'Registrar log de auditoria',
    description: 'Cria um registro de log para auditoria de ações'
  })
  @ApiResponse({ status: 201, description: 'Log registrado' })
  async registrarLog(@Body() dto: RegistrarLogDto) {
    try {
      const log = await this.logAuditoriaService.registrar(
        dto.acao,
        dto.entidade,
        dto.detalhes,
        dto.usuario,
        dto.ip,
        dto.userAgent,
      );

      return {
        success: true,
        mensagem: 'Log registrado com sucesso',
        log,
      };
    } catch (error) {
      this.logger.error('Erro ao registrar log', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao registrar log de auditoria',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Buscar logs de auditoria com filtros
   */
  @Get('logs/auditoria')
  @ApiOperation({ 
    summary: 'Buscar logs de auditoria',
    description: 'Retorna logs com filtros opcionais'
  })
  @ApiResponse({ status: 200, description: 'Logs recuperados' })
  async buscarLogs(
    @Body() dto?: BuscarLogsDto,
  ) {
    try {
      const filtros: any = {};

      if (dto?.acao) filtros.acao = dto.acao;
      if (dto?.entidade) filtros.entidade = dto.entidade;
      if (dto?.usuario) filtros.usuario = dto.usuario;
      if (dto?.dataInicio) filtros.dataInicio = new Date(dto.dataInicio);
      if (dto?.dataFim) filtros.dataFim = new Date(dto.dataFim);
      if (dto?.limit) filtros.limit = dto.limit;
      if (dto?.offset) filtros.offset = dto.offset;

      const resultado = await this.logAuditoriaService.buscar(filtros);

      return {
        success: true,
        ...resultado,
      };
    } catch (error) {
      this.logger.error('Erro ao buscar logs', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao buscar logs de auditoria',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Buscar logs recentes (últimas 24h)
   */
  @Get('logs/auditoria/recentes')
  @ApiOperation({ 
    summary: 'Logs recentes',
    description: 'Retorna logs das últimas 24 horas'
  })
  @ApiResponse({ status: 200, description: 'Logs recuperados' })
  async logsRecentes() {
    try {
      const logs = await this.logAuditoriaService.buscarRecentes(100);

      return {
        success: true,
        logs,
        total: logs.length,
      };
    } catch (error) {
      this.logger.error('Erro ao buscar logs recentes', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao buscar logs recentes',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Estatísticas de uso
   */
  @Get('logs/auditoria/estatisticas')
  @ApiOperation({ 
    summary: 'Estatísticas de uso',
    description: 'Retorna estatísticas de uso dos últimos 7 dias'
  })
  @ApiResponse({ status: 200, description: 'Estatísticas recuperadas' })
  async estatisticasLogs() {
    try {
      const estatisticas = await this.logAuditoriaService.estatisticas(7);

      return {
        success: true,
        ...estatisticas,
      };
    } catch (error) {
      this.logger.error('Erro ao buscar estatísticas', error);
      throw new HttpException(
        {
          success: false,
          mensagem: 'Erro ao buscar estatísticas',
          erro: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
