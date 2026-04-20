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
  ParseDatePipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { OCRService } from './ocr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { 
  ProcessarImagemOCRDto,
  TestarOCRDto,
  ConfiguracaoOCRDto,
  ResultadoOCRDto,
  RelatorioOCRDto,
  TipoAnaliseOCR,
} from './dto/ocr.dto';

@ApiTags('OCR - Reconhecimento Óptico de Caracteres')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ocr')
export class OCRController {
  private readonly logger = new Logger(OCRController.name);

  constructor(private readonly ocrService: OCRService) {}

  @Post('processar')
  @ApiOperation({ summary: 'Processar imagem com OCR' })
  @ApiResponse({ 
    status: 201, 
    description: 'Imagem processada com sucesso',
    type: ResultadoOCRDto
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou erro no processamento' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async processarImagem(@Body() dto: ProcessarImagemOCRDto) {
    try {
      this.logger.log(`Processando imagem OCR - Tipo: ${dto.tipoAnalise}`);
      
      const resultado = await this.ocrService.processarImagem(dto);
      
      return {
        sucesso: true,
        dados: resultado,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao processar imagem OCR', error);
      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro no processamento OCR',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('processar-upload')
  @ApiOperation({ summary: 'Processar imagem enviada via upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('imagem'))
  @ApiResponse({ 
    status: 201, 
    description: 'Upload e processamento realizados com sucesso',
    type: ResultadoOCRDto
  })
  async processarImagemUpload(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('tipoAnalise') tipoAnalise: TipoAnaliseOCR,
    @Body('atendimentoId') atendimentoId?: string,
    @Body('documentoId') documentoId?: string,
    @Body('idiomas') idiomas?: string,
    @Body('extrairBlocos') extrairBlocos?: string,
    @Body('detectarOrientacao') detectarOrientacao?: string,
  ) {
    try {
      if (!arquivo) {
        throw new HttpException('Nenhum arquivo enviado', HttpStatus.BAD_REQUEST);
      }

      if (!tipoAnalise) {
        throw new HttpException('Tipo de análise é obrigatório', HttpStatus.BAD_REQUEST);
      }

      // Converter arquivo para base64
      const imagemBase64 = `data:${arquivo.mimetype};base64,${arquivo.buffer.toString('base64')}`;

      // Processar parâmetros opcionais
      const idiomasArray = idiomas ? idiomas.split(',').map(i => i.trim()) : undefined;
      const extrairBlocosBoolean = extrairBlocos === 'true';
      const detectarOrientacaoBoolean = detectarOrientacao === 'true';

      this.logger.log(`Processando upload OCR - Arquivo: ${arquivo.originalname}, Tipo: ${tipoAnalise}`);

      const dto: ProcessarImagemOCRDto = {
        imagem: imagemBase64,
        tipoAnalise: tipoAnalise as TipoAnaliseOCR,
        atendimentoId,
        documentoId,
        idiomas: idiomasArray,
        extrairBlocos: extrairBlocosBoolean,
        detectarOrientacao: detectarOrientacaoBoolean,
      };

      const resultado = await this.ocrService.processarImagem(dto);

      return {
        sucesso: true,
        dados: resultado,
        arquivo: {
          nome: arquivo.originalname,
          tamanho: arquivo.size,
          tipo: arquivo.mimetype,
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('Erro ao processar upload OCR', error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          sucesso: false,
          mensagem: 'Erro no processamento do upload',
          erro: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('testar')
  @ApiOperation({ summary: 'Testar conexão e funcionamento do OCR' })
  @ApiResponse({ 
    status: 201, 
    description: 'Teste realizado com sucesso',
    schema: {
      example: {
        sucesso: true,
        dados: {
          sucesso: true,
          detalhes: {
            provedor: 'Google Vision API',
            versao: '3.1.0',
            texto_detectado: 'TESTE OCR...',
            confianca: 0.95,
            tempo_processamento: 1500
          }
        }
      }
    }
  })
  async testarConexao(@Body() dto: TestarOCRDto) {
    try {
      this.logger.log('Testando conexão OCR');
      
      const resultado = await this.ocrService.testarConexao(dto);
      
      return {
        sucesso: true,
        dados: resultado,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro no teste de conexão OCR', error);
      return {
        sucesso: false,
        mensagem: 'Erro no teste de conexão',
        erro: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('configuracoes')
  @ApiOperation({ summary: 'Obter configurações do OCR' })
  @ApiResponse({ 
    status: 200, 
    description: 'Configurações obtidas com sucesso',
    type: ConfiguracaoOCRDto
  })
  async obterConfiguracoes() {
    try {
      const configuracoes = await this.ocrService.obterConfiguracoes();
      
      return {
        sucesso: true,
        dados: configuracoes,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao obter configurações OCR', error);
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
  @ApiOperation({ summary: 'Obter histórico de processamentos OCR' })
  @ApiResponse({ 
    status: 200, 
    description: 'Histórico obtido com sucesso',
    schema: {
      example: {
        sucesso: true,
        dados: {
          data: [/* histórico */],
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
  async obterHistorico(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('tipoAnalise') tipoAnalise?: string,
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

      const historico = await this.ocrService.obterHistorico(
        pageNum, 
        limitNum, 
        tipoAnalise,
        dataInicioObj,
        dataFimObj
      );
      
      return {
        sucesso: true,
        dados: historico,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao obter histórico OCR', error);
      
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
  @ApiOperation({ summary: 'Obter relatório de estatísticas OCR' })
  @ApiResponse({ 
    status: 200, 
    description: 'Relatório gerado com sucesso',
    type: RelatorioOCRDto
  })
  async obterRelatorio() {
    try {
      const relatorio = await this.ocrService.obterRelatorio();
      
      return {
        sucesso: true,
        dados: relatorio,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erro ao gerar relatório OCR', error);
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
  @ApiOperation({ summary: 'Listar tipos de análise OCR disponíveis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tipos de análise listados com sucesso',
    schema: {
      example: {
        sucesso: true,
        dados: [
          {
            tipo: 'PEDIDO_EXAME',
            nome: 'Pedido de Exame',
            descricao: 'Análise específica para pedidos médicos de exames'
          }
        ]
      }
    }
  })
  async listarTiposAnalise() {
    const tipos = [
      {
        tipo: TipoAnaliseOCR.TEXTO_GERAL,
        nome: 'Texto Geral',
        descricao: 'Reconhecimento genérico de texto em imagens',
      },
      {
        tipo: TipoAnaliseOCR.PEDIDO_EXAME,
        nome: 'Pedido de Exame',
        descricao: 'Análise específica para pedidos médicos de exames',
      },
      {
        tipo: TipoAnaliseOCR.RECEITA_MEDICA,
        nome: 'Receita Médica',
        descricao: 'Extração de informações de receitas médicas',
      },
      {
        tipo: TipoAnaliseOCR.DOCUMENTO_MEDICO,
        nome: 'Documento Médico',
        descricao: 'Reconhecimento geral de documentos médicos',
      },
      {
        tipo: TipoAnaliseOCR.CARTEIRA_CONVENIO,
        nome: 'Carteira de Convênio',
        descricao: 'Extração de dados de carteiras de convênio médico',
      },
      {
        tipo: TipoAnaliseOCR.DOCUMENTO_IDENTIFICACAO,
        nome: 'Documento de Identificação',
        descricao: 'Análise de RG, CPF, CNH e outros documentos',
      },
      {
        tipo: TipoAnaliseOCR.ATESTADO,
        nome: 'Atestado Médico',
        descricao: 'Extração de informações de atestados médicos',
      },
      {
        tipo: TipoAnaliseOCR.EXAME_LABORATORIAL,
        nome: 'Exame Laboratorial',
        descricao: 'Análise de resultados de exames de laboratório',
      },
    ];

    return {
      sucesso: true,
      dados: tipos,
      total: tipos.length,
      timestamp: new Date().toISOString(),
    };
  }
}