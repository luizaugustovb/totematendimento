import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OcrComparisonService {
  private readonly logger = new Logger(OcrComparisonService.name);

  constructor(private configService: ConfigService) {}

  /**
   * AWS Textract - Detecção de texto em documentos
   */
  async processarAWSTextract(base64Image: string) {
    const inicio = Date.now();
    
    try {
      // Remover prefixo data:image se existir
      const imageBytes = base64Image.includes(',') 
        ? Buffer.from(base64Image.split(',')[1], 'base64')
        : Buffer.from(base64Image, 'base64');

      // Importar AWS SDK dinamicamente
      const { TextractClient, DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');
      
      const client = new TextractClient({
        region: this.configService.get('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY')
        }
      });

      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: imageBytes
        }
      });

      const response = await client.send(command);
      
      // Extrair texto de todos os blocos
      let textoCompleto = '';
      let confiancaMedia = 0;
      let totalBlocos = 0;

      response.Blocks?.forEach(block => {
        if (block.BlockType === 'LINE') {
          textoCompleto += (block.Text || '') + '\n';
          confiancaMedia += block.Confidence || 0;
          totalBlocos++;
        }
      });

      confiancaMedia = totalBlocos > 0 ? confiancaMedia / totalBlocos : 0;
      const tempo = (Date.now() - inicio) / 1000;

      this.logger.log(`✅ AWS Textract: ${tempo.toFixed(2)}s, confiança: ${confiancaMedia.toFixed(1)}%`);

      return {
        texto: textoCompleto.trim(),
        confianca: confiancaMedia,
        tempo,
        blocos: response.Blocks?.length || 0
      };
    } catch (erro) {
      this.logger.error('❌ Erro AWS Textract:', erro);
      throw new Error(`AWS Textract falhou: ${erro.message}`);
    }
  }

  /**
   * Google Cloud Vision - Text Detection
   */
  async processarGoogleVision(base64Image: string) {
    const inicio = Date.now();
    
    try {
      // Importar Google Vision SDK dinamicamente
      const vision = await import('@google-cloud/vision');
      
      // Client usa automaticamente GOOGLE_APPLICATION_CREDENTIALS do .env
      const client = new vision.ImageAnnotatorClient();

      // Remover prefixo data:image se existir
      const imageContent = base64Image.includes(',') 
        ? base64Image.split(',')[1]
        : base64Image;

      const [result] = await client.textDetection({
        image: {
          content: Buffer.from(imageContent, 'base64')
        }
      });

      const detections = result.textAnnotations || [];
      const texto = detections[0]?.description || '';
      
      // Calcular confiança média das palavras
      const fullTextAnnotation = result.fullTextAnnotation;
      let confiancaMedia = 0;
      let totalPalavras = 0;

      if (fullTextAnnotation?.pages) {
        fullTextAnnotation.pages.forEach(page => {
          page.blocks?.forEach(block => {
            block.paragraphs?.forEach(paragraph => {
              paragraph.words?.forEach(word => {
                if (word.confidence) {
                  confiancaMedia += word.confidence;
                  totalPalavras++;
                }
              });
            });
          });
        });
      }

      confiancaMedia = totalPalavras > 0 ? (confiancaMedia / totalPalavras) * 100 : 95;
      const tempo = (Date.now() - inicio) / 1000;

      this.logger.log(`✅ Google Vision: ${tempo.toFixed(2)}s, confiança: ${confiancaMedia.toFixed(1)}%`);

      return {
        texto: texto.trim(),
        confianca: confiancaMedia,
        tempo,
        palavras: detections.length - 1 // -1 porque primeiro é texto completo
      };
    } catch (erro) {
      this.logger.error('❌ Erro Google Vision:', erro);
      throw new Error(`Google Vision falhou: ${erro.message}`);
    }
  }

  /**
   * Azure Computer Vision - OCR
   */
  async processarAzureVision(base64Image: string) {
    const inicio = Date.now();
    
    try {
      const apiKey = this.configService.get('AZURE_VISION_API_KEY');
      const endpoint = this.configService.get('AZURE_VISION_ENDPOINT');
      
      if (!apiKey || !endpoint) {
        throw new Error('AZURE_VISION_API_KEY ou AZURE_VISION_ENDPOINT não configurados');
      }

      // Converter base64 para bytes
      const imageBytes = base64Image.includes(',')
        ? Buffer.from(base64Image.split(',')[1], 'base64')
        : Buffer.from(base64Image, 'base64');

      // Usar Read API (melhor para documentos)
      const analyzeUrl = `${endpoint}/vision/v3.2/read/analyze?language=pt`;
      
      const analyzeResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/octet-stream'
        },
        body: imageBytes
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error?.message || 'Erro ao analisar imagem');
      }

      // Obter operation location
      const operationLocation = analyzeResponse.headers.get('Operation-Location');
      
      if (!operationLocation) {
        throw new Error('Operation-Location não retornado');
      }

      // Aguardar resultado (polling)
      let resultado;
      let tentativas = 0;
      const maxTentativas = 30;

      while (tentativas < maxTentativas) {
        await this.sleep(500); // 500ms entre tentativas
        
        const resultResponse = await fetch(operationLocation, {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey
          }
        });

        resultado = await resultResponse.json();
        
        if (resultado.status === 'succeeded') {
          break;
        } else if (resultado.status === 'failed') {
          throw new Error('Azure OCR falhou no processamento');
        }
        
        tentativas++;
      }

      if (resultado.status !== 'succeeded') {
        throw new Error('Timeout aguardando resultado Azure OCR');
      }

      // Extrair texto
      let textoCompleto = '';
      let totalLinhas = 0;

      resultado.analyzeResult?.readResults?.forEach(page => {
        page.lines?.forEach(line => {
          textoCompleto += line.text + '\n';
          totalLinhas++;
        });
      });

      const tempo = (Date.now() - inicio) / 1000;
      const confianca = 92; // Azure Read API não retorna confiança, usar estimativa alta

      this.logger.log(`✅ Azure Vision: ${tempo.toFixed(2)}s, ${totalLinhas} linhas`);

      return {
        texto: textoCompleto.trim(),
        confianca,
        tempo,
        linhas: totalLinhas
      };
    } catch (erro) {
      this.logger.error('❌ Erro Azure Vision:', erro);
      throw new Error(`Azure Vision falhou: ${erro.message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
