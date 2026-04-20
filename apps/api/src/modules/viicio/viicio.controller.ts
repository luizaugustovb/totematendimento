import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query,
  UseGuards, 
  Logger, 
  HttpException, 
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ViicioService } from './viicio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { 
  EnviarMensagemDto, 
  TesteMensagemDto,
  ConfiguracaoViicioDto,
  TemplateViicioDto,
  RelatorioMensagensDto
} from './dto/viicio.dto';

@ApiTags('Viicio - Mensagens WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viicio')
export class ViicioController {
  private readonly logger = new Logger(ViicioController.name);

  constructor(private readonly viicioService: ViicioService) {}

  @Post('mensagem')
  @ApiOperation({ summary: 'Enviar mensagem WhatsApp' })
  @ApiResponse({ 
    status: 201, 
    description: 'Mensagem enviada com sucesso',
    schema: {
      example: {
        mensagemId: 'uuid-da-mensagem',
        status: 'PROCESSANDO',
        template: 'atendimento_cadastrado',
        telefone: '5511999999999'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async enviarMensagem(@Body() dto: EnviarMensagemDto) {
    try {
      this.logger.log(`Enviando mensagem WhatsApp - Template: ${dto.template}, Telefone: ${dto.telefone}`);
      const resultado = await this.viicioService.enviarMensagem(dto);
      return {
        sucesso: true,
        dados: resultado,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao enviar mensagem WhatsApp', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao processar envio de mensagem',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('teste')
  @ApiOperation({ summary: 'Testar conexão com a API Viicio' })
  @ApiResponse({ 
    status: 201, 
    description: 'Teste realizado com sucesso',
    schema: {
      example: {
        sucesso: true,
        mensagem: 'Teste realizado com sucesso',
        resposta: { /* resposta da API */ }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Erro no teste' })
  async testarConexao(@Body() dto: TesteMensagemDto) {
    try {
      this.logger.log(`Testando conexão Viicio - Telefone: ${dto.telefone}`);
      const resultado = await this.viicioService.testarConexao(dto);
      return {
        sucesso: true,
        dados: resultado,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro no teste de conexão', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro no teste de conexão',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('configuracoes')
  @ApiOperation({ summary: 'Obter configurações do Viicio' })
  @ApiResponse({ 
    status: 200, 
    description: 'Configurações obtidas com sucesso',
    type: ConfiguracaoViicioDto
  })
  async obterConfiguracoes(): Promise<any> {
    try {
      const configuracoes = await this.viicioService.obterConfiguracoes();
      return {
        sucesso: true,
        dados: configuracoes,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao obter configurações', error);
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

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates de mensagem disponíveis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Templates listados com sucesso',
    type: [TemplateViicioDto]
  })
  async listarTemplates(): Promise<any> {
    try {
      const templates = await this.viicioService.listarTemplates();
      return {
        sucesso: true,
        dados: templates,
        total: templates.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao listar templates', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao listar templates',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('template/:nome')
  @ApiOperation({ summary: 'Obter template específico' })
  @ApiResponse({ 
    status: 200, 
    description: 'Template encontrado',
    type: TemplateViicioDto
  })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async obterTemplate(@Param('nome') nome: string): Promise<any> {
    try {
      const template = await this.viicioService.obterTemplate(nome);
      
      if (!template) {
        throw new HttpException(
          {
            sucesso: false,
            mensagem: `Template '${nome}' não encontrado`,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        sucesso: true,
        dados: template,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erro ao obter template ${nome}`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao obter template',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('mensagens')
  @ApiOperation({ summary: 'Listar mensagens enviadas' })
  @ApiResponse({ 
    status: 200, 
    description: 'Mensagens listadas com sucesso',
    schema: {
      example: {
        sucesso: true,
        dados: {
          data: [/* mensagens */],
          meta: {
            total: 100,
            page: 1,
            limit: 20,
            totalPages: 5
          }
        }
      }
    }
  })
  async listarMensagens(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ): Promise<any> {
    try {
      const pageNum = page && page > 0 ? page : 1;
      const limitNum = limit && limit > 0 && limit <= 100 ? limit : 20;

      const mensagens = await this.viicioService.listarMensagens(pageNum, limitNum, status);
      
      return {
        sucesso: true,
        dados: mensagens,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao listar mensagens', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao listar mensagens',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('relatorio')
  @ApiOperation({ summary: 'Obter relatório de estatísticas de mensagens' })
  @ApiResponse({ 
    status: 200, 
    description: 'Relatório gerado com sucesso',
    type: RelatorioMensagensDto
  })
  async obterRelatorio(): Promise<any> {
    try {
      const relatorio = await this.viicioService.obterRelatorio();
      return {
        sucesso: true,
        dados: relatorio,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao gerar relatório', error);
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

  @Post('reprocessar-pendentes')
  @ApiOperation({ summary: 'Reprocessar mensagens pendentes ou com erro' })
  @ApiResponse({ 
    status: 201, 
    description: 'Reprocessamento iniciado',
    schema: {
      example: {
        sucesso: true,
        mensagem: 'Reprocessamento de mensagens pendentes iniciado',
        timestamp: '2026-01-26T...'
      }
    }
  })
  async reprocessarMensagensPendentes(): Promise<any> {
    try {
      this.logger.log('Iniciando reprocessamento de mensagens pendentes');
      
      // Executar de forma assíncrona para não bloquear a resposta
      this.viicioService.reprocessarMensagensPendentes().catch(error => {
        this.logger.error('Erro durante reprocessamento de mensagens pendentes', error);
      });

      return {
        sucesso: true,
        mensagem: 'Reprocessamento de mensagens pendentes iniciado',
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

  @Get('mensagem/:id')
  @ApiOperation({ summary: 'Obter detalhes de uma mensagem específica' })
  @ApiResponse({ 
    status: 200, 
    description: 'Detalhes da mensagem obtidos com sucesso'
  })
  @ApiResponse({ status: 404, description: 'Mensagem não encontrada' })
  async obterMensagem(@Param('id') id: string): Promise<any> {
    try {
      // Este método seria implementado no service se necessário
      // Por enquanto, retornamos uma resposta básica
      return {
        sucesso: true,
        mensagem: 'Funcionalidade em desenvolvimento',
        id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erro ao obter mensagem ${id}`, error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao obter mensagem',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook para receber atualizações da Viicio' })
  @ApiResponse({ status: 200, description: 'Webhook processado com sucesso' })
  async webhook(@Body() payload: any): Promise<any> {
    try {
      this.logger.log('Webhook Viicio recebido', JSON.stringify(payload));
      
      // Aqui implementaríamos o processamento do webhook
      // Por exemplo, atualizar status de mensagens, receber respostas, etc.
      
      return {
        sucesso: true,
        mensagem: 'Webhook processado',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao processar webhook', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro ao processar webhook',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}