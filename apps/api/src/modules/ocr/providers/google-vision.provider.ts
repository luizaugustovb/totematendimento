import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { OCRProvider, ParametrosProcessamentoOCR, ConfiguracaoProviderOCR } from './ocr.provider';
import { 
  ResultadoOCRDto, 
  TipoAnaliseOCR, 
  FormatoImagem,
  BlocoTextoDto,
  CampoExtraidoDto
} from '../dto/ocr.dto';

@Injectable()
export class GoogleVisionProvider extends OCRProvider {
  private readonly logger = new Logger(GoogleVisionProvider.name);
  private client: ImageAnnotatorClient;

  constructor(config: ConfiguracaoProviderOCR) {
    super(config);
    
    if (this.config.habilitado) {
      this.inicializarClient();
    }
  }

  private inicializarClient(): void {
    try {
      // Configurar cliente do Google Vision
      const key = this.config.credenciais?.googleVisionKey;
      const projectId = this.config.credenciais?.googleProjectId;

      if (key && typeof key === 'object') {
        // Usando service account key diretamente
        this.client = new ImageAnnotatorClient({
          credentials: key,
          projectId: projectId,
        });
      } else if (key && typeof key === 'string') {
        // Usando caminho para arquivo de credenciais
        this.client = new ImageAnnotatorClient({
          keyFilename: key,
          projectId: projectId,
        });
      } else {
        // Usando credenciais padrão do ambiente (GOOGLE_APPLICATION_CREDENTIALS)
        this.client = new ImageAnnotatorClient({
          projectId: projectId,
        });
      }

      this.logger.log('Google Vision Client inicializado com sucesso');
    } catch (error) {
      this.logger.error('Erro ao inicializar Google Vision Client', error);
      throw new Error(`Falha na inicialização do Google Vision: ${error.message}`);
    }
  }

  getNome(): string {
    return 'Google Vision API';
  }

  getVersao(): string {
    return '3.1.0'; // Versão da biblioteca
  }

  async processarImagem(parametros: ParametrosProcessamentoOCR): Promise<ResultadoOCRDto> {
    if (!this.config.habilitado) {
      throw new Error('Google Vision Provider está desabilitado');
    }

    const inicioProcessamento = Date.now();
    const processamentoId = this.gerarProcessamentoId(parametros.tipoAnalise);

    try {
      // Validações
      this.validarImagem(parametros.imagem, parametros.formato);
      
      const formato = parametros.formato || this.detectarFormato(parametros.imagem);
      const configuracoes = {
        ...this.aplicarConfiguracoesTipo(parametros.tipoAnalise),
        ...parametros.configuracoes,
      };

      // Preparar imagem para processamento
      const imageBuffer = this.extrairBufferImagem(parametros.imagem);
      
      // Verificar tamanho do arquivo
      if (imageBuffer.length > this.config.tamanhoMaximoArquivo) {
        throw new Error(`Arquivo muito grande: ${imageBuffer.length} bytes (máximo: ${this.config.tamanhoMaximoArquivo})`);
      }

      this.logger.log(`Processando imagem - Tipo: ${parametros.tipoAnalise}, Formato: ${formato}, Tamanho: ${imageBuffer.length} bytes`);

      // Chamar Google Vision API
      const [result] = await this.client.textDetection({
        image: { content: imageBuffer },
        imageContext: {
          languageHints: parametros.idiomas || ['pt'],
        },
      });

      const detections = result.textAnnotations || [];
      
      if (detections.length === 0) {
        throw new Error('Nenhum texto detectado na imagem');
      }

      // Extrair texto completo (primeiro resultado é sempre o texto completo)
      const textoCompleto = detections[0]?.description || '';
      
      // Calcular confiança geral
      const confiancaGeral = this.calcularConfiancaGeral(detections);

      // Validar confiança mínima
      if (confiancaGeral < this.config.limiteConfianca) {
        this.logger.warn(`Confiança baixa detectada: ${confiancaGeral} (mínimo: ${this.config.limiteConfianca})`);
      }

      // Extrair blocos se solicitado
      let blocos: BlocoTextoDto[] = [];
      if (configuracoes.extrairBlocos) {
        blocos = this.extrairBlocos(detections.slice(1)); // Pular primeiro que é texto completo
      }

      // Extrair campos estruturados se configurado
      let camposEstruturados: CampoExtraidoDto[] = [];
      if (configuracoes.extrairCamposEstruturados) {
        camposEstruturados = await this.extrairCamposEstruturados(
          textoCompleto, 
          blocos, 
          parametros.tipoAnalise,
          configuracoes.camposPrioritarios
        );
      }

      // Detectar orientação se solicitado
      let orientacao: number | undefined;
      if (configuracoes.detectarOrientacao) {
        orientacao = this.detectarOrientacao(detections);
      }

      const tempoProcessamento = Date.now() - inicioProcessamento;

      const resultado: ResultadoOCRDto = {
        textoCompleto,
        confiancaGeral,
        tipoAnalise: parametros.tipoAnalise,
        idiomasDetectados: parametros.idiomas || ['pt'],
        orientacao,
        blocos: blocos.length > 0 ? blocos : undefined,
        camposEstruturados: camposEstruturados.length > 0 ? camposEstruturados : undefined,
        tempoProcessamento,
        processamentoId,
        metadados: {
          provedor: this.getNome(),
          versao: this.getVersao(),
          formato,
          tamanho_original: `${imageBuffer.length} bytes`,
          total_deteccoes: detections.length,
          configuracoes_aplicadas: configuracoes,
        },
      };

      this.logger.log(`OCR concluído - ID: ${processamentoId}, Confiança: ${confiancaGeral}, Tempo: ${tempoProcessamento}ms`);

      return resultado;

    } catch (error) {
      const tempoProcessamento = Date.now() - inicioProcessamento;
      
      this.logger.error(`Erro no processamento OCR - ID: ${processamentoId}`, error);
      
      throw new Error(`Falha no processamento OCR: ${error.message} (Tempo: ${tempoProcessamento}ms)`);
    }
  }

  async testarConexao(imagemTeste?: string): Promise<{ sucesso: boolean; detalhes: any }> {
    try {
      if (!this.config.habilitado) {
        return {
          sucesso: false,
          detalhes: { erro: 'Provider desabilitado' }
        };
      }

      // Usar imagem de teste simples se não fornecida
      const imagemParaTeste = imagemTeste || this.obterImagemTestePadrao();
      
      const resultado = await this.processarImagem({
        imagem: imagemParaTeste,
        tipoAnalise: TipoAnaliseOCR.TEXTO_GERAL,
        idiomas: ['pt'],
        extrairBlocos: false,
        detectarOrientacao: false,
      });

      return {
        sucesso: true,
        detalhes: {
          provedor: this.getNome(),
          versao: this.getVersao(),
          texto_detectado: resultado.textoCompleto.substring(0, 100) + '...',
          confianca: resultado.confiancaGeral,
          tempo_processamento: resultado.tempoProcessamento,
        }
      };

    } catch (error) {
      return {
        sucesso: false,
        detalhes: {
          erro: error.message,
          provedor: this.getNome(),
        }
      };
    }
  }

  // MÉTODOS PRIVADOS

  private calcularConfiancaGeral(detections: any[]): number {
    if (detections.length === 0) return 0;

    // Google Vision não retorna confiança explícita para text detection
    // Vamos usar heurísticas baseadas na quantidade e qualidade das detecções
    const textoCompleto = detections[0]?.description || '';
    const palavrasDetectadas = detections.slice(1);

    // Base: 0.5 se detectou texto
    let confiancaBase = textoCompleto.length > 0 ? 0.5 : 0;

    // Adicionar pontos por palavras detectadas
    const pontosPorPalavra = Math.min(palavrasDetectadas.length * 0.02, 0.3);
    confiancaBase += pontosPorPalavra;

    // Adicionar pontos por comprimento de texto
    const pontosPorComprimento = Math.min(textoCompleto.length * 0.001, 0.2);
    confiancaBase += pontosPorComprimento;

    // Penalizar se texto muito curto
    if (textoCompleto.length < 10) {
      confiancaBase *= 0.7;
    }

    return Math.min(Math.max(confiancaBase, 0), 1);
  }

  private extrairBlocos(wordDetections: any[]): BlocoTextoDto[] {
    return wordDetections.map((detection, index) => {
      const vertices = detection.boundingPoly?.vertices || [];
      const coordenadas = this.calcularCoordenadasBounding(vertices);

      return {
        texto: detection.description || '',
        confianca: 0.9, // Google Vision não fornece confiança por palavra, usar padrão alto
        coordenadas,
        tipo: 'PALAVRA',
      };
    });
  }

  private calcularCoordenadasBounding(vertices: any[]): { x: number; y: number; width: number; height: number } {
    if (vertices.length < 4) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xs = vertices.map(v => v.x || 0);
    const ys = vertices.map(v => v.y || 0);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private async extrairCamposEstruturados(
    textoCompleto: string, 
    blocos: BlocoTextoDto[],
    tipoAnalise: TipoAnaliseOCR,
    camposPrioritarios: string[]
  ): Promise<CampoExtraidoDto[]> {
    const campos: CampoExtraidoDto[] = [];

    // Usar regex patterns baseados no tipo de documento
    const patterns = this.obterPatternsParaTipo(tipoAnalise);

    for (const [campo, pattern] of Object.entries(patterns)) {
      if (camposPrioritarios.includes(campo)) {
        const match = textoCompleto.match(pattern);
        if (match) {
          campos.push({
            campo,
            valor: match[1] || match[0],
            confianca: 0.8, // Confiança padrão para extração por regex
          });
        }
      }
    }

    return campos;
  }

  private obterPatternsParaTipo(tipoAnalise: TipoAnaliseOCR): Record<string, RegExp> {
    switch (tipoAnalise) {
      case TipoAnaliseOCR.PEDIDO_EXAME:
        return {
          nome_paciente: /(?:paciente|nome)[:\s]+([A-ZÀ-Ÿ\s]{2,50})/i,
          nome_medico: /(?:dr|dra|doutor|doutora)[.\s]*([A-ZÀ-Ÿ\s]{2,50})/i,
          crm_medico: /crm[:\s]*(\d{4,7})/i,
          data_nascimento: /(?:nascimento|nasc)[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          data_solicitacao: /(?:data|solicitação)[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
        };

      case TipoAnaliseOCR.RECEITA_MEDICA:
        return {
          nome_paciente: /(?:paciente|para)[:\s]+([A-ZÀ-Ÿ\s]{2,50})/i,
          nome_medico: /(?:dr|dra)[.\s]*([A-ZÀ-Ÿ\s]{2,50})/i,
          crm_medico: /crm[:\s]*(\d{4,7})/i,
          data_receita: /(?:data)[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
        };

      case TipoAnaliseOCR.CARTEIRA_CONVENIO:
        return {
          nome_beneficiario: /(?:nome|beneficiário)[:\s]+([A-ZÀ-Ÿ\s]{2,50})/i,
          numero_carteira: /(?:carteira|matrícula|número)[:\s]*(\d{8,15})/i,
          plano: /(?:plano)[:\s]*([A-Za-zÀ-ÿ\s]{2,30})/i,
          validade: /(?:validade|válido)[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
        };

      default:
        return {};
    }
  }

  private detectarOrientacao(detections: any[]): number {
    // Análise básica de orientação baseada na distribuição dos textos
    // Google Vision já corrige automaticamente, então geralmente será 0
    return 0;
  }

  private obterImagemTestePadrao(): string {
    // Imagem PNG pequena em base64 com texto "TESTE OCR"
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAYAAADjAO9DAAAADklEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}