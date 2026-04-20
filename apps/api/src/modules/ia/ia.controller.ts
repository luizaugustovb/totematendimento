import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Query,
  UseGuards, 
  Logger, 
  HttpException, 
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IAService } from './ia.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { 
  ProcessarTextoIADto,
  NormalizarExamesDto,
  TestarIADto,
  ConfiguracaoIADto,
  ResultadoAnaliseIADto,
  ResultadoNormalizacaoExamesDto,
  RelatorioIADto,
  TipoAnaliseIA,
  ModeloIA,
} from './dto/ia.dto';

@ApiTags('IA - Inteligência Artificial')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ia')
export class IAController {
  private readonly logger = new Logger(IAController.name);

  constructor(private readonly iaService: IAService) {}

  @Post('processar')
  @ApiOperation({ summary: 'Processar texto usando IA para análise específica' })
  @ApiResponse({ 
    status: 201, 
    description: 'Texto processado com sucesso',
    type: ResultadoAnaliseIADto
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou erro no processamento' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async processarTexto(@Body() dto: ProcessarTextoIADto) {
    try {
      this.logger.log(`Processando texto IA - Tipo: ${dto.tipoAnalise}, Modelo: ${dto.modelo || 'padrão'}`);
      
      const resultado = await this.iaService.processarTexto(dto);
      
      return {
        sucesso: true,
        dados: resultado,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao processar texto IA', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro no processamento IA',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('normalizar-exames')
  @ApiOperation({ summary: 'Normalizar lista de exames usando IA' })
  @ApiResponse({ 
    status: 201, 
    description: 'Exames normalizados com sucesso',
    type: ResultadoNormalizacaoExamesDto
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou erro na normalização' })
  async normalizarExames(@Body() dto: NormalizarExamesDto) {
    try {
      this.logger.log(`Normalizando ${dto.exames?.length || 0} exames com IA`);
      
      const resultado = await this.iaService.normalizarExames(dto);
      
      return {
        sucesso: true,
        dados: resultado,
        estatisticas: {
          total_processados: resultado.estatisticas.total_exames,
          normalizados_sucesso: resultado.estatisticas.normalizados_com_sucesso,
          baixa_confianca: resultado.estatisticas.normalizados_com_baixa_confianca,
          nao_reconhecidos: resultado.estatisticas.nao_reconhecidos,
          taxa_sucesso: `${((resultado.estatisticas.normalizados_com_sucesso / resultado.estatisticas.total_exames) * 100).toFixed(1)}%`,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao normalizar exames', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro na normalização de exames',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('normalizar-exames-simples')
  @ApiOperation({ summary: 'Normalizar lista simples de exames (apenas nomes)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Normalização simples realizada com sucesso' 
  })
  async normalizarExamesSimples(@Body('exames') exames: string[]) {
    try {
      if (!Array.isArray(exames) || exames.length === 0) {
        throw new BadRequestException('Lista de exames deve ser um array não vazio');
      }

      const dto: NormalizarExamesDto = {
        exames,
        incluirSugestoes: false,
        verificarConsistencia: true,
      };

      const resultado = await this.iaService.normalizarExames(dto);
      
      // Retornar apenas os dados essenciais para integração simples
      return {
        sucesso: true,
        exames_normalizados: resultado.examesNormalizados.map(exame => ({
          original: exame.exameOriginal,
          normalizado: exame.exameNormalizado,
          codigo: exame.codigoExame,
          confianca: exame.confianca,
          categoria: exame.categoria,
        })),
        estatisticas: resultado.estatisticas,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro na normalização simples de exames', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro na normalização simples',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('interpretar-documento')
  @ApiOperation({ summary: 'Interpretar documento médico usando IA' })
  @ApiResponse({ 
    status: 201, 
    description: 'Documento interpretado com sucesso' 
  })
  async interpretarDocumento(
    @Body('texto') texto: string,
    @Body('contexto') contexto?: string,
    @Body('documentoId') documentoId?: string,
    @Body('atendimentoId') atendimentoId?: string,
  ) {
    try {
      if (!texto || texto.trim().length === 0) {
        throw new BadRequestException('Texto do documento é obrigatório');
      }

      const dto: ProcessarTextoIADto = {
        texto,
        tipoAnalise: TipoAnaliseIA.INTERPRETACAO_DOCUMENTO,
        contexto,
        documentoId,
        atendimentoId,
        modelo: ModeloIA.CLAUDE_SONNET,
        temperatura: 0.3,
      };

      const resultado = await this.iaService.processarTexto(dto);
      
      return {
        sucesso: true,
        interpretacao: resultado.resultado,
        dados_estruturados: resultado.dadosEstruturados,
        confianca: resultado.confiancaGeral,
        sugestoes: resultado.sugestoes,
        alertas: resultado.alertas,
        tempo_processamento: resultado.tempoProcessamento,
        tokens_utilizados: resultado.tokensUtilizados.total,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao interpretar documento', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro na interpretação do documento',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('extrair-dados')
  @ApiOperation({ summary: 'Extrair dados estruturados de texto médico' })
  @ApiResponse({ 
    status: 201, 
    description: 'Dados extraídos com sucesso' 
  })
  async extrairDados(
    @Body('texto') texto: string,
    @Body('contexto') contexto?: string,
    @Body('modelo') modelo?: ModeloIA,
  ) {
    try {
      if (!texto || texto.trim().length === 0) {
        throw new BadRequestException('Texto é obrigatório');
      }

      const dto: ProcessarTextoIADto = {
        texto,
        tipoAnalise: TipoAnaliseIA.EXTRACAO_DADOS_ESTRUTURADOS,
        contexto,
        modelo: modelo || ModeloIA.CLAUDE_SONNET,
        temperatura: 0.1, // Baixa temperatura para extração precisa
      };

      const resultado = await this.iaService.processarTexto(dto);
      
      return {
        sucesso: true,
        dados_extraidos: resultado.dadosEstruturados,
        confianca: resultado.confiancaGeral,
        tempo_processamento: resultado.tempoProcessamento,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao extrair dados', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro na extração de dados',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('classificar-documento')
  @ApiOperation({ summary: 'Classificar tipo de documento médico' })
  @ApiResponse({ 
    status: 201, 
    description: 'Documento classificado com sucesso' 
  })
  async classificarDocumento(@Body('texto') texto: string) {
    try {
      if (!texto || texto.trim().length === 0) {
        throw new BadRequestException('Texto do documento é obrigatório');
      }

      const dto: ProcessarTextoIADto = {
        texto,
        tipoAnalise: TipoAnaliseIA.CLASSIFICACAO_DOCUMENTO,
        modelo: ModeloIA.CLAUDE_HAIKU, // Usar modelo mais rápido para classificação
        temperatura: 0.2,
        maxTokens: 500,
      };

      const resultado = await this.iaService.processarTexto(dto);
      
      return {
        sucesso: true,
        classificacao: resultado.dadosEstruturados,
        confianca: resultado.confiancaGeral,
        tempo_processamento: resultado.tempoProcessamento,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao classificar documento', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro na classificação do documento',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('validar-consistencia')
  @ApiOperation({ summary: 'Validar consistência de informações médicas' })
  @ApiResponse({ 
    status: 201, 
    description: 'Validação de consistência realizada' 
  })
  async validarConsistencia(
    @Body('texto') texto: string,
    @Body('contexto') contexto?: string,
  ) {
    try {
      if (!texto || texto.trim().length === 0) {
        throw new BadRequestException('Texto é obrigatório');
      }

      const dto: ProcessarTextoIADto = {
        texto,
        tipoAnalise: TipoAnaliseIA.VALIDACAO_CONSISTENCIA,
        contexto,
        modelo: ModeloIA.CLAUDE_SONNET,
        temperatura: 0.2,
      };

      const resultado = await this.iaService.processarTexto(dto);
      
      return {
        sucesso: true,
        validacao: resultado.dadosEstruturados,
        inconsistencias: resultado.alertas,
        sugestoes: resultado.sugestoes,
        score_consistencia: resultado.confiancaGeral,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro na validação de consistência', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro na validação de consistência',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sugerir-correcoes')
  @ApiOperation({ summary: 'Sugerir correções em texto médico' })
  @ApiResponse({ 
    status: 201, 
    description: 'Sugestões de correção geradas' 
  })
  async sugerirCorrecoes(@Body('texto') texto: string) {
    try {
      if (!texto || texto.trim().length === 0) {
        throw new BadRequestException('Texto é obrigatório');
      }

      const dto: ProcessarTextoIADto = {
        texto,
        tipoAnalise: TipoAnaliseIA.SUGESTAO_CORRECAO,
        modelo: ModeloIA.CLAUDE_SONNET,
        temperatura: 0.5,
      };

      const resultado = await this.iaService.processarTexto(dto);
      
      return {
        sucesso: true,
        sugestoes_correcao: resultado.dadosEstruturados,
        tempo_processamento: resultado.tempoProcessamento,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao sugerir correções', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao gerar sugestões de correção',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('resumir')
  @ApiOperation({ summary: 'Resumir conteúdo médico' })
  @ApiResponse({ 
    status: 201, 
    description: 'Resumo gerado com sucesso' 
  })
  async resumirConteudo(
    @Body('texto') texto: string,
    @Body('contexto') contexto?: string,
  ) {
    try {
      if (!texto || texto.trim().length === 0) {
        throw new BadRequestException('Texto é obrigatório');
      }

      const dto: ProcessarTextoIADto = {
        texto,
        tipoAnalise: TipoAnaliseIA.RESUMO_CONTEUDO,
        contexto,
        modelo: ModeloIA.CLAUDE_SONNET,
        temperatura: 0.4,
        maxTokens: 1500,
      };

      const resultado = await this.iaService.processarTexto(dto);
      
      return {
        sucesso: true,
        resumo: resultado.dadosEstruturados,
        tempo_processamento: resultado.tempoProcessamento,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao resumir conteúdo', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao gerar resumo',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('testar')
  @ApiOperation({ summary: 'Testar conexão e funcionamento da IA' })
  @ApiResponse({ 
    status: 201, 
    description: 'Teste realizado com sucesso' 
  })
  async testarConexao(@Body() dto: TestarIADto) {
    try {
      this.logger.log('Testando conexão IA');
      
      const resultado = await this.iaService.testarConexao(dto);
      
      return {
        sucesso: true,
        dados: resultado,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro no teste de conexão IA', error);
      return {
        sucesso: false,
        mensagem: 'Erro no teste de conexão',
        erro: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('configuracoes')
  @ApiOperation({ summary: 'Obter configurações da IA' })
  @ApiResponse({ 
    status: 200, 
    description: 'Configurações obtidas com sucesso',
    type: ConfiguracaoIADto
  })
  async obterConfiguracoes() {
    try {
      const configuracoes = await this.iaService.obterConfiguracoes();
      
      return {
        sucesso: true,
        dados: configuracoes,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao obter configurações IA', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao obter configurações',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('historico')
  @ApiOperation({ summary: 'Obter histórico de processamentos IA' })
  @ApiQuery({ name: 'page', required: false, description: 'Página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit por página (padrão: 20, máximo: 100)' })
  @ApiQuery({ name: 'tipoAnalise', required: false, description: 'Filtrar por tipo de análise' })
  @ApiQuery({ name: 'modelo', required: false, description: 'Filtrar por modelo' })
  @ApiQuery({ name: 'dataInicio', required: false, description: 'Data início (ISO 8601)' })
  @ApiQuery({ name: 'dataFim', required: false, description: 'Data fim (ISO 8601)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Histórico obtido com sucesso' 
  })
  async obterHistorico(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('tipoAnalise') tipoAnalise?: string,
    @Query('modelo') modelo?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    try {
      const pageNum = page && page > 0 ? page : 1;
      const limitNum = limit && limit > 0 && limit <= 100 ? limit : 20;

      // Converter strings de data se fornecidas
      let dataInicioObj: Date | undefined;
      let dataFimObj: Date | undefined;

      if (dataInicio) {
        dataInicioObj = new Date(dataInicio);
        if (isNaN(dataInicioObj.getTime())) {
          throw new BadRequestException('Data de início inválida');
        }
      }

      if (dataFim) {
        dataFimObj = new Date(dataFim);
        if (isNaN(dataFimObj.getTime())) {
          throw new BadRequestException('Data de fim inválida');
        }
      }

      const historico = await this.iaService.obterHistorico(
        pageNum, 
        limitNum, 
        tipoAnalise,
        modelo,
        dataInicioObj,
        dataFimObj
      );
      
      return {
        sucesso: true,
        dados: historico,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao obter histórico IA', error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao obter histórico',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('relatorio')
  @ApiOperation({ summary: 'Obter relatório de estatísticas da IA' })
  @ApiResponse({ 
    status: 200, 
    description: 'Relatório gerado com sucesso',
    type: RelatorioIADto
  })
  async obterRelatorio() {
    try {
      const relatorio = await this.iaService.obterRelatorio();
      
      return {
        sucesso: true,
        dados: relatorio,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao gerar relatório IA', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao gerar relatório',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('tipos-analise')
  @ApiOperation({ summary: 'Listar tipos de análise IA disponíveis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tipos de análise listados com sucesso' 
  })
  async listarTiposAnalise() {
    const tipos = [
      {
        tipo: TipoAnaliseIA.NORMALIZACAO_EXAMES,
        nome: 'Normalização de Exames',
        descricao: 'Normaliza nomes de exames para padrões reconhecidos no sistema',
        recomendado_para: 'Processamento de pedidos médicos e integração de dados',
      },
      {
        tipo: TipoAnaliseIA.INTERPRETACAO_DOCUMENTO,
        nome: 'Interpretação de Documento',
        descricao: 'Interpreta e extrai informações relevantes de documentos médicos',
        recomendado_para: 'Análise de receitas, laudos e pedidos médicos',
      },
      {
        tipo: TipoAnaliseIA.EXTRACAO_DADOS_ESTRUTURADOS,
        nome: 'Extração de Dados Estruturados',
        descricao: 'Extrai dados específicos em formato estruturado (JSON)',
        recomendado_para: 'Integração automatizada e processamento de dados',
      },
      {
        tipo: TipoAnaliseIA.CLASSIFICACAO_DOCUMENTO,
        nome: 'Classificação de Documento',
        descricao: 'Identifica o tipo de documento médico',
        recomendado_para: 'Triagem automática e organização de documentos',
      },
      {
        tipo: TipoAnaliseIA.VALIDACAO_CONSISTENCIA,
        nome: 'Validação de Consistência',
        descricao: 'Verifica consistência e coerência das informações médicas',
        recomendado_para: 'Controle de qualidade e detecção de inconsistências',
      },
      {
        tipo: TipoAnaliseIA.SUGESTAO_CORRECAO,
        nome: 'Sugestão de Correção',
        descricao: 'Sugere correções e melhorias em textos médicos',
        recomendado_para: 'Revisão de documentos e padronização de textos',
      },
      {
        tipo: TipoAnaliseIA.RESUMO_CONTEUDO,
        nome: 'Resumo de Conteúdo',
        descricao: 'Cria resumos concisos de documentos ou textos médicos',
        recomendado_para: 'Relatórios executivos e sínteses de informações',
      },
    ];

    return {
      sucesso: true,
      dados: tipos,
      total: tipos.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('modelos')
  @ApiOperation({ summary: 'Listar modelos de IA disponíveis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Modelos listados com sucesso' 
  })
  async listarModelos() {
    const modelos = [
      {
        modelo: ModeloIA.CLAUDE_SONNET,
        nome: 'Claude 3.5 Sonnet',
        descricao: 'Modelo mais avançado, ideal para tarefas complexas',
        velocidade: 'Média',
        precisao: 'Alta',
        custo: 'Alto',
        recomendado_para: ['normalização exames', 'interpretação documentos', 'análises complexas'],
      },
      {
        modelo: ModeloIA.CLAUDE_HAIKU,
        nome: 'Claude 3 Haiku',
        descricao: 'Modelo rápido e eficiente para tarefas simples',
        velocidade: 'Alta',
        precisao: 'Boa',
        custo: 'Baixo',
        recomendado_para: ['classificação documentos', 'testes', 'resumos simples'],
      },
      {
        modelo: ModeloIA.GPT4,
        nome: 'GPT-4',
        descricao: 'Modelo OpenAI para análises avançadas (não implementado)',
        velocidade: 'Baixa',
        precisao: 'Alta',
        custo: 'Alto',
        status: 'Não implementado',
      },
      {
        modelo: ModeloIA.GPT35_TURBO,
        nome: 'GPT-3.5 Turbo',
        descricao: 'Modelo OpenAI rápido para tarefas gerais (não implementado)',
        velocidade: 'Alta',
        precisao: 'Boa',
        custo: 'Médio',
        status: 'Não implementado',
      },
    ];

    return {
      sucesso: true,
      dados: modelos,
      total: modelos.length,
      implementados: modelos.filter(m => !m.status).length,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reprocessar-falhados')
  @ApiOperation({ summary: 'Reprocessar análises que falharam recentemente' })
  @ApiResponse({ 
    status: 201, 
    description: 'Reprocessamento iniciado' 
  })
  async reprocessarFalhados() {
    try {
      this.logger.log('Iniciando reprocessamento de análises IA falhadas');
      
      // Executar de forma assíncrona para não bloquear a resposta
      this.iaService.reprocessarFalhados().catch(error => {
        this.logger.error('Erro durante reprocessamento de análises IA falhadas', error);
      });

      return {
        sucesso: true,
        mensagem: 'Reprocessamento de análises falhadas iniciado',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao iniciar reprocessamento', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao iniciar reprocessamento',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}