import { TipoAnaliseOCR, FormatoImagem, ResultadoOCRDto } from '../dto/ocr.dto';

export interface ConfiguracaoProviderOCR {
  habilitado: boolean;
  timeout: number;
  limiteConfianca: number;
  tamanhoMaximoArquivo: number;
  credenciais: Record<string, any>;
}

export interface ParametrosProcessamentoOCR {
  imagem: string; // Base64 ou path
  tipoAnalise: TipoAnaliseOCR;
  formato?: FormatoImagem;
  idiomas?: string[];
  extrairBlocos?: boolean;
  detectarOrientacao?: boolean;
  configuracoes?: Record<string, any>;
}

export abstract class OCRProvider {
  protected config: ConfiguracaoProviderOCR;
  
  constructor(config: ConfiguracaoProviderOCR) {
    this.config = config;
  }

  abstract getNome(): string;
  abstract getVersao(): string;
  
  /**
   * Processa uma imagem e extrai texto usando OCR
   */
  abstract processarImagem(parametros: ParametrosProcessamentoOCR): Promise<ResultadoOCRDto>;
  
  /**
   * Testa a conexão e funcionamento do provedor
   */
  abstract testarConexao(imagemTeste?: string): Promise<{ sucesso: boolean; detalhes: any }>;
  
  /**
   * Valida se a imagem está em formato suportado
   */
  protected validarImagem(imagem: string, formato?: FormatoImagem): void {
    if (!imagem || imagem.trim().length === 0) {
      throw new Error('Imagem não fornecida');
    }

    // Verificar se é base64
    if (imagem.startsWith('data:image/') || imagem.startsWith('/9j/')) {
      // Base64 válido
      return;
    }

    // Verificar se é URL ou path válido
    if (imagem.startsWith('http') || imagem.startsWith('/') || imagem.includes('.')) {
      return;
    }

    throw new Error('Formato de imagem não reconhecido (deve ser base64 ou path)');
  }

  /**
   * Detecta formato da imagem baseado no conteúdo
   */
  protected detectarFormato(imagem: string): FormatoImagem {
    if (imagem.startsWith('data:image/jpeg') || imagem.startsWith('/9j/')) {
      return FormatoImagem.JPEG;
    }
    if (imagem.startsWith('data:image/png') || imagem.startsWith('iVBORw0KGgo')) {
      return FormatoImagem.PNG;
    }
    if (imagem.startsWith('data:image/webp')) {
      return FormatoImagem.WEBP;
    }
    if (imagem.startsWith('data:application/pdf') || imagem.startsWith('JVBERi0')) {
      return FormatoImagem.PDF;
    }
    if (imagem.startsWith('data:image/tiff')) {
      return FormatoImagem.TIFF;
    }

    // Se termina com extensão, usar ela
    if (imagem.toLowerCase().endsWith('.jpg') || imagem.toLowerCase().endsWith('.jpeg')) {
      return FormatoImagem.JPEG;
    }
    if (imagem.toLowerCase().endsWith('.png')) {
      return FormatoImagem.PNG;
    }
    if (imagem.toLowerCase().endsWith('.webp')) {
      return FormatoImagem.WEBP;
    }
    if (imagem.toLowerCase().endsWith('.pdf')) {
      return FormatoImagem.PDF;
    }
    if (imagem.toLowerCase().endsWith('.tif') || imagem.toLowerCase().endsWith('.tiff')) {
      return FormatoImagem.TIFF;
    }

    // Padrão
    return FormatoImagem.JPEG;
  }

  /**
   * Converte base64 para buffer se necessário
   */
  protected extrairBufferImagem(imagem: string): Buffer {
    if (imagem.startsWith('data:')) {
      // Remove o prefixo data:image/format;base64,
      const base64Data = imagem.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    } else if (this.isBase64(imagem)) {
      return Buffer.from(imagem, 'base64');
    } else {
      throw new Error('Imagem deve estar em formato base64');
    }
  }

  /**
   * Verifica se string é base64 válido
   */
  protected isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch (err) {
      return false;
    }
  }

  /**
   * Aplica configurações específicas do tipo de análise
   */
  protected aplicarConfiguracoesTipo(tipoAnalise: TipoAnaliseOCR): Record<string, any> {
    const configuracoesPadrao = {
      extrairBlocos: true,
      detectarOrientacao: true,
      idiomas: ['pt'],
    };

    switch (tipoAnalise) {
      case TipoAnaliseOCR.PEDIDO_EXAME:
        return {
          ...configuracoesPadrao,
          extrairCamposEstruturados: true,
          camposPrioritarios: [
            'nome_paciente',
            'data_nascimento', 
            'nome_medico',
            'crm_medico',
            'exames_solicitados',
            'data_solicitacao'
          ],
          detectarTabelas: true,
        };

      case TipoAnaliseOCR.RECEITA_MEDICA:
        return {
          ...configuracoesPadrao,
          extrairCamposEstruturados: true,
          camposPrioritarios: [
            'nome_paciente',
            'nome_medico',
            'crm_medico',
            'medicamentos',
            'posologia',
            'data_receita'
          ],
        };

      case TipoAnaliseOCR.CARTEIRA_CONVENIO:
        return {
          ...configuracoesPadrao,
          extrairCamposEstruturados: true,
          camposPrioritarios: [
            'nome_beneficiario',
            'numero_carteira',
            'plano',
            'validade',
            'convenio'
          ],
          detectarCodigoBarras: true,
        };

      case TipoAnaliseOCR.DOCUMENTO_IDENTIFICACAO:
        return {
          ...configuracoesPadrao,
          extrairCamposEstruturados: true,
          camposPrioritarios: [
            'nome',
            'documento',
            'data_nascimento',
            'data_expedicao',
            'orgao_expedidor'
          ],
        };

      default:
        return configuracoesPadrao;
    }
  }

  /**
   * Gera ID único para o processamento
   */
  protected gerarProcessamentoId(tipoAnalise: TipoAnaliseOCR): string {
    const timestamp = Date.now();
    const prefixo = tipoAnalise.toLowerCase().replace('_', '');
    const aleatorio = Math.random().toString(36).substring(2, 8);
    return `${prefixo}_${timestamp}_${aleatorio}`;
  }
}