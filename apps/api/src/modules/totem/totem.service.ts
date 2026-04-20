import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OCRService } from '../ocr/ocr.service';
import { SqlServerService } from './services/sql-server.service';
import { StorageService } from '../../core/storage/storage.service';
import {
  ProcessarDocumentoDto,
  ConsultaClienteResponseDto,
  ProcessarCarteirinhaDto,
  SalvarAtendimentoDto,
  SalvarAtendimentoResponseDto,
} from './dto/totem.dto';
import { TipoAnaliseOCR } from '../ocr/dto/ocr.dto';

@Injectable()
export class TotemService {
  private readonly logger = new Logger(TotemService.name);

  constructor(
    private prisma: PrismaService,
    private ocrService: OCRService,
    private sqlServerService: SqlServerService,
    private storageService: StorageService,
  ) {}

  /**
   * Processa documento (CNH/RG) com OCR e consulta cliente no SQL Server
   */
  async processarDocumento(dto: ProcessarDocumentoDto): Promise<ConsultaClienteResponseDto> {
    try {
      this.logger.log('Processando documento com OCR');

      let dadosOCR = dto.dados_ocr;

      // Se dados OCR não foram fornecidos, processar agora
      if (!dadosOCR || !dadosOCR.cpf) {
        this.logger.log('Executando OCR no documento');
        
        const resultadoOCR = await this.ocrService.processarImagem({
          imagem: dto.imagem,
          tipoAnalise: TipoAnaliseOCR.DOCUMENTO_IDENTIFICACAO,
          extrairBlocos: true,
          detectarOrientacao: true,
        });

        // Extrair dados estruturados do resultado OCR
        dadosOCR = this.extrairDadosDocumento(resultadoOCR);
        
        this.logger.log('OCR concluído', { dadosOCR });
      }

      // Validar se CPF foi extraído
      if (!dadosOCR.cpf) {
        return {
          success: false,
          cliente_encontrado: false,
          dados_ocr: dadosOCR,
          mensagem: 'CPF não foi identificado no documento. Tente capturar novamente com melhor iluminação.',
        };
      }

      // Consultar cliente no SQL Server
      this.logger.log(`Consultando cliente no SQL Server - CPF: ${dadosOCR.cpf}`);
      
      const clienteSQLServer = await this.sqlServerService.consultarClientePorCPF(dadosOCR.cpf);

      if (clienteSQLServer) {
        // Cliente encontrado no banco legado
        this.logger.log(`Cliente encontrado: ${clienteSQLServer.nome}`);
        
        return {
          success: true,
          cliente_encontrado: true,
          dados_cliente: clienteSQLServer,
          dados_ocr: dadosOCR,
          mensagem: 'Cliente encontrado no sistema',
        };
      }

      // Cliente não encontrado - novo cadastro
      this.logger.log('Cliente não encontrado - novo cadastro');
      
      return {
        success: true,
        cliente_encontrado: false,
        dados_ocr: dadosOCR,
        mensagem: 'Cliente não encontrado. Será realizado novo cadastro.',
      };

    } catch (error) {
      this.logger.error('Erro ao processar documento', error);
      
      return {
        success: false,
        cliente_encontrado: false,
        mensagem: `Erro ao processar documento: ${error.message}`,
      };
    }
  }

  /**
   * Processa carteirinha de convênio com OCR
   */
  async processarCarteirinha(dto: ProcessarCarteirinhaDto): Promise<any> {
    try {
      this.logger.log('Processando carteirinha com OCR');

      let dadosOCR = dto.dados_ocr;

      // Se dados OCR não foram fornecidos, processar agora
      if (!dadosOCR || !dadosOCR.numero_carteirinha) {
        this.logger.log('Executando OCR na carteirinha');
        
        const resultadoOCR = await this.ocrService.processarImagem({
          imagem: dto.imagem,
          tipoAnalise: TipoAnaliseOCR.CARTEIRA_CONVENIO,
          extrairBlocos: true,
          detectarOrientacao: true,
        });

        // Extrair dados estruturados do resultado OCR
        dadosOCR = this.extrairDadosCarteirinha(resultadoOCR);
        
        this.logger.log('OCR da carteirinha concluído', { dadosOCR });
      }

      // Se convenio foi selecionado manualmente, usar ele
      if (dto.convenio && !dadosOCR.convenio) {
        dadosOCR.convenio = dto.convenio;
      }

      return {
        success: true,
        dados_carteirinha: dadosOCR,
        mensagem: 'Carteirinha processada com sucesso',
      };

    } catch (error) {
      this.logger.error('Erro ao processar carteirinha', error);
      
      return {
        success: false,
        mensagem: `Erro ao processar carteirinha: ${error.message}`,
      };
    }
  }

  /**
   * Salva atendimento completo no banco de dados
   */
  async salvarAtendimento(dto: SalvarAtendimentoDto): Promise<SalvarAtendimentoResponseDto> {
    try {
      this.logger.log('Salvando atendimento completo');

      // Gerar protocolo de atendimento
      const protocolo = this.gerarProtocolo();

      // Buscar ou criar convênio
      const convenio = await this.buscarOuCriarConvenio(dto.convenio);

      // Buscar ou criar paciente
      let paciente;
      
      if (dto.cliente_id) {
        // Cliente existente - buscar no Prisma
        paciente = await this.prisma.paciente.findUnique({
          where: { id: dto.cliente_id },
        });

        // Se não encontrou no Prisma, criar novo
        if (!paciente) {
          paciente = await this.criarPaciente(dto.dados_cliente);
        }
      } else {
        // Verificar se já existe por CPF
        paciente = await this.prisma.paciente.findFirst({
          where: { cpf: dto.dados_cliente.cpf?.replace(/[^\d]/g, '') },
        });

        if (!paciente) {
          paciente = await this.criarPaciente(dto.dados_cliente);
        }
      }

      // Salvar imagens no storage
      const [imagemDocumentoUrl, imagemCarteirinhaUrl, imagemGuiasUrl] = await Promise.all([
        this.salvarImagem(dto.imagem_documento, 'documento', paciente.id),
        this.salvarImagem(dto.imagem_carteirinha, 'carteirinha', paciente.id),
        dto.imagem_guias 
          ? this.salvarImagem(dto.imagem_guias, 'guias', paciente.id)
          : Promise.resolve(null),
      ]);

      // Criar atendimento
      const atendimento = await this.prisma.atendimento.create({
        data: {
          protocolo,
          pacienteId: paciente.id,
          convenioId: convenio.id,
          status: 'AGUARDANDO_COLETA',
          origem: 'TOTEM',
          dadosCarteirinhaJson: dto.dados_carteirinha,
          clienteConfirmado: dto.cliente_confirmado || false,
        },
      });

      // Criar registros de documentos capturados
      await Promise.all([
        this.prisma.documentoCapturado.create({
          data: {
            atendimentoId: atendimento.id,
            tipo: 'DOCUMENTO_IDENTIFICACAO',
            nomeArquivo: `documento_${paciente.id}_${Date.now()}.png`,
            caminhoArquivo: imagemDocumentoUrl,
            tamanhoBytes: this.calcularTamanhoBase64(dto.imagem_documento),
            status: 'COMPLETED',
            metadadosJson: {
              cpf: dto.dados_cliente.cpf,
              nome: dto.dados_cliente.nome,
            },
          },
        }),
        this.prisma.documentoCapturado.create({
          data: {
            atendimentoId: atendimento.id,
            tipo: 'CARTEIRA_CONVENIO',
            nomeArquivo: `carteirinha_${paciente.id}_${Date.now()}.png`,
            caminhoArquivo: imagemCarteirinhaUrl,
            tamanhoBytes: this.calcularTamanhoBase64(dto.imagem_carteirinha),
            status: 'COMPLETED',
            metadadosJson: dto.dados_carteirinha,
          },
        }),
      ]);

      // Se houver guias, criar documento
      if (dto.imagem_guias && imagemGuiasUrl) {
        await this.prisma.documentoCapturado.create({
          data: {
            atendimentoId: atendimento.id,
            tipo: 'PEDIDO_EXAME',
            nomeArquivo: `guias_${paciente.id}_${Date.now()}.png`,
            caminhoArquivo: imagemGuiasUrl,
            tamanhoBytes: this.calcularTamanhoBase64(dto.imagem_guias),
            status: 'PENDING',
          },
        });
      }

      // Log de sistema
      await this.prisma.logSistema.create({
        data: {
          modulo: 'TOTEM',
          nivel: 'INFO',
          mensagem: 'Novo atendimento criado via totem',
          contextoJson: {
            protocolo,
            atendimento_id: atendimento.id,
            paciente_id: paciente.id,
            convenio: dto.convenio,
            cliente_encontrado: !!dto.cliente_id,
          },
        },
      });

      this.logger.log(`Atendimento salvo com sucesso - Protocolo: ${protocolo}`);

      return {
        success: true,
        protocolo,
        atendimento_id: atendimento.id,
        cliente_id: paciente.id,
        message: 'Atendimento registrado com sucesso',
        dados: {
          paciente: {
            nome: paciente.nomeCompleto,
            cpf: paciente.cpf,
          },
          convenio: convenio.nome,
          protocolo,
        },
      };

    } catch (error) {
      this.logger.error('Erro ao salvar atendimento', error);
      
      return {
        success: false,
        message: `Erro ao salvar atendimento: ${error.message}`,
      };
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Extrai dados estruturados do resultado do OCR de documento
   */
  private extrairDadosDocumento(resultadoOCR: any): any {
    const texto = resultadoOCR.textoCompleto || '';
    const dados: any = { texto_completo: texto };

    // Extrair CPF
    const cpfMatch = texto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
    if (cpfMatch) {
      dados.cpf = cpfMatch[1].replace(/[^\d]/g, '');
    }

    // Extrair RG
    const rgMatch = texto.match(/RG[\s:]*(\d[\d\.\-]+)/i);
    if (rgMatch) {
      dados.rg = rgMatch[1].replace(/[^\d]/g, '');
    }

    // Extrair Nome
    const nomeMatch = texto.match(/NOME[\s:]+([A-ZÀ-Ú\s]+)/i);
    if (nomeMatch) {
      dados.nome = nomeMatch[1].trim();
    }

    // Extrair Data de Nascimento
    const dataNascMatch = texto.match(/(?:DATA\s+NASCIMENTO|NASCIMENTO)[\s:]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dataNascMatch) {
      dados.data_nascimento = dataNascMatch[1];
    }

    // Extrair Nome da Mãe
    const nomeMaeMatch = texto.match(/(?:FILIA[ÇC][ÃA]O|M[ÃA]E)[\s:]+([A-ZÀ-Ú\s]+)/i);
    if (nomeMaeMatch) {
      dados.nome_mae = nomeMaeMatch[1].trim();
    }

    return dados;
  }

  /**
   * Extrai dados estruturados do resultado do OCR de carteirinha
   */
  private extrairDadosCarteirinha(resultadoOCR: any): any {
    const texto = resultadoOCR.textoCompleto || '';
    const dados: any = { texto_completo: texto };

    // Extrair número da carteirinha
    const carteirinhaMatch = texto.match(/(?:CARTEIRA|CARD|N[ºo°])[\s:]*([0-9]{8,20})/i);
    if (carteirinhaMatch) {
      dados.numero_carteirinha = carteirinhaMatch[1];
    }

    // Extrair nome titular
    const nomeTitularMatch = texto.match(/(?:TITULAR|NOME)[\s:]+([A-ZÀ-Ú\s]+)/i);
    if (nomeTitularMatch) {
      dados.nome_titular = nomeTitularMatch[1].trim();
    }

    // Extrair validade
    const validadeMatch = texto.match(/VALIDADE[\s:]*(\d{2}\/\d{2}\/\d{4})/i);
    if (validadeMatch) {
      dados.validade = validadeMatch[1];
    }

    // Identificar convênio
    const convenios = ['UNIMED', 'AMIL', 'BRADESCO', 'SULAMERICA', 'NOTREDAME'];
    for (const convenio of convenios) {
      if (texto.toUpperCase().includes(convenio)) {
        dados.convenio = convenio;
        break;
      }
    }

    return dados;
  }

  /**
   * Busca ou cria convênio
   */
  private async buscarOuCriarConvenio(nomeConvenio: string) {
    const nomeNormalizado = nomeConvenio.toLowerCase();
    
    let convenio = await this.prisma.convenio.findFirst({
      where: {
        OR: [
          { codigo: nomeNormalizado },
          { nome: { contains: nomeConvenio, mode: 'insensitive' } },
        ],
      },
    });

    if (!convenio) {
      convenio = await this.prisma.convenio.create({
        data: {
          nome: nomeConvenio.toUpperCase(),
          codigo: nomeNormalizado,
          exigeCarteirinha: true,
          ativo: true,
        },
      });
    }

    return convenio;
  }

  /**
   * Cria novo paciente
   */
  private async criarPaciente(dadosCliente: any) {
    return await this.prisma.paciente.create({
      data: {
        nomeCompleto: dadosCliente.nome,
        cpf: dadosCliente.cpf?.replace(/[^\d]/g, ''),
        rg: dadosCliente.rg?.replace(/[^\d]/g, ''),
        dataNascimento: dadosCliente.data_nascimento 
          ? this.converterDataParaISO(dadosCliente.data_nascimento)
          : null,
        telefone: dadosCliente.telefone,
        email: dadosCliente.email,
        endereco: dadosCliente.endereco,
        nomeMae: dadosCliente.nome_mae,
        ativo: true,
      },
    });
  }

  /**
   * Salva imagem no storage e retorna URL
   */
  private async salvarImagem(imagemBase64: string, tipo: string, pacienteId: string): Promise<string> {
    try {
      // Remove prefixo data:image
      const base64Data = imagemBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const fileName = `${tipo}_${pacienteId}_${Date.now()}.png`;
      const filePath = `totem/${tipo}/${fileName}`;
      
      await this.storageService.salvarArquivo(filePath, buffer);
      
      return filePath;
    } catch (error) {
      this.logger.error(`Erro ao salvar imagem ${tipo}`, error);
      return imagemBase64; // Fallback: retorna base64
    }
  }

  /**
   * Gera protocolo de atendimento único
   */
  private gerarProtocolo(): string {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    
    return `AT${year}${month}${day}${random}`;
  }

  /**
   * Calcula tamanho aproximado de string base64 em bytes
   */
  private calcularTamanhoBase64(base64String: string): number {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Math.floor((base64Data.length * 3) / 4);
  }

  /**
   * Converte data do formato brasileiro para ISO
   */
  private converterDataParaISO(dataBR: string): Date | null {
    try {
      const [dia, mes, ano] = dataBR.split('/');
      return new Date(`${ano}-${mes}-${dia}`);
    } catch {
      return null;
    }
  }

  /**
   * Listar todos os exames cadastrados
   */
  async listarExames() {
    return await this.prisma.exame.findMany({
      where: {
        ativo: true,
      },
      include: {
        sinonimos: {
          where: { ativo: true },
          take: 5,
        },
      },
      orderBy: {
        nomePadrao: 'asc',
      },
    });
  }

  /**
   * Listar todos os médicos cadastrados
   */
  async listarMedicos() {
    return await this.prisma.medico.findMany({
      orderBy: {
        nome: 'asc',
      },
      take: 100,
    });
  }
}
