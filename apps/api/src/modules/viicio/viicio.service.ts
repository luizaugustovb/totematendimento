import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { 
  EnviarMensagemDto, 
  TesteMensagemDto,
  ConfiguracaoViicioDto,
  TemplateViicioDto,
  RelatorioMensagensDto
} from './dto/viicio.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ViicioService {
  private readonly logger = new Logger(ViicioService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly habilitado: boolean;
  private readonly timeout: number;
  private readonly maxTentativas: number;

  // Templates padrão do sistema
  private readonly templatesPadrao = {
    'atendimento_cadastrado': {
      nome: 'atendimento_cadastrado',
      texto: 'Olá {{nome_paciente}}! Seu atendimento foi cadastrado com sucesso no laboratório. Protocolo: {{protocolo}}. Unidade: {{unidade}}. Em breve você receberá mais informações sobre a coleta.',
      descricao: 'Mensagem enviada após cadastro do atendimento no totem',
      ativo: true,
    },
    'atendimento_autorizado': {
      nome: 'atendimento_autorizado',
      texto: 'Olá {{nome_paciente}}! Seus exames foram autorizados pelo convênio {{convenio}}. Protocolo: {{protocolo}}. Você pode comparecer à unidade para realizar a coleta.',
      descricao: 'Mensagem enviada quando exames são autorizados',
      ativo: true,
    },
    'resultado_disponivel': {
      nome: 'resultado_disponivel',
      texto: 'Olá {{nome_paciente}}! O resultado dos seus exames já está disponível. Protocolo: {{protocolo}}. Acesse nosso portal ou compareça à unidade para retirar.',
      descricao: 'Mensagem enviada quando resultado fica pronto',
      ativo: true,
    },
    'lembrete_coleta': {
      nome: 'lembrete_coleta',
      texto: 'Olá {{nome_paciente}}! Lembramos que você tem exames agendados. Protocolo: {{protocolo}}. Não esqueça do preparo necessário. Em caso de dúvidas, entre em contato.',
      descricao: 'Lembrete sobre coleta de exames',
      ativo: true,
    },
  };

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get<string>('VIICIO_API_URL', '');
    this.apiToken = this.configService.get<string>('VIICIO_API_TOKEN', '');
    this.habilitado = this.configService.get<string>('VIICIO_ENABLED', 'false') === 'true';
    this.timeout = this.configService.get<number>('VIICIO_TIMEOUT_MS', 30000);
    this.maxTentativas = this.configService.get<number>('VIICIO_MAX_TENTATIVAS', 3);

    if (this.habilitado && (!this.apiUrl || !this.apiToken)) {
      this.logger.warn('Viicio habilitado mas configuração incompleta (URL ou Token em branco)');
    }
  }

  async enviarMensagem(dto: EnviarMensagemDto): Promise<any> {
    const { atendimentoId, telefone, template, variaveis = {} } = dto;

    // Verificar se o serviço está habilitado
    if (!this.habilitado) {
      this.logger.warn('Tentativa de envio de mensagem com Viicio desabilitado');
      throw new BadRequestException('Serviço de mensagens está desabilitado');
    }

    // Buscar template na configuração
    const templateConfig = await this.obterTemplate(template);
    if (!templateConfig) {
      throw new BadRequestException(`Template '${template}' não encontrado`);
    }

    // Processar template com variáveis
    const mensagemProcessada = this.processarTemplate(templateConfig.texto, variaveis);

    // Criar registro de mensagem
    const mensagemRecord = await this.prisma.mensagemViicio.create({
      data: {
        atendimentoId,
        telefone: this.formatarTelefone(telefone),
        template,
        payloadJson: {
          template,
          variaveis,
          mensagem_processada: mensagemProcessada,
          telefone_formatado: this.formatarTelefone(telefone),
        },
        status: 'PENDENTE',
        tentativas: 0,
      },
    });

    this.logger.log(`Mensagem criada para envio: ${mensagemRecord.id} - Template: ${template}`);

    // Tentar enviar imediatamente
    try {
      await this.processarEnvio(mensagemRecord.id);
    } catch (error) {
      this.logger.error(`Falha no envio imediato da mensagem ${mensagemRecord.id}`, error);
      // Não propagar o erro - mensagem ficará pendente para reprocessamento
    }

    return {
      mensagemId: mensagemRecord.id,
      status: 'PROCESSANDO',
      template,
      telefone: this.formatarTelefone(telefone),
    };
  }

  async processarEnvio(mensagemId: string): Promise<void> {
    const mensagem = await this.prisma.mensagemViicio.findUnique({
      where: { id: mensagemId },
    });

    if (!mensagem) {
      this.logger.error(`Mensagem ${mensagemId} não encontrada`);
      return;
    }

    if (!['PENDENTE', 'ERRO'].includes(mensagem.status)) {
      this.logger.warn(`Mensagem ${mensagemId} não está em status apropriado para envio: ${mensagem.status}`);
      return;
    }

    if (mensagem.tentativas >= this.maxTentativas) {
      await this.prisma.mensagemViicio.update({
        where: { id: mensagemId },
        data: {
          status: 'FALHOU_DEFINITIVO',
          ultimaTentativa: new Date(),
        },
      });
      this.logger.error(`Mensagem ${mensagemId} falhou definitivamente após ${mensagem.tentativas} tentativas`);
      return;
    }

    // Atualizar para status enviando
    await this.prisma.mensagemViicio.update({
      where: { id: mensagemId },
      data: {
        status: 'ENVIANDO',
        tentativas: mensagem.tentativas + 1,
        ultimaTentativa: new Date(),
      },
    });

    try {
      // Chamar API da Viicio
      const payload = this.construirPayloadAPI(mensagem);
      const resposta = await this.chamarAPIViicio(payload);

      // Sucesso
      await this.prisma.mensagemViicio.update({
        where: { id: mensagemId },
        data: {
          status: 'ENVIADO',
          respostaJson: resposta,
        },
      });

      this.logger.log(`Mensagem ${mensagemId} enviada com sucesso para ${mensagem.telefone}`);

      // Log de sistema
      await this.prisma.logSistema.create({
        data: {
          modulo: 'VIICIO',
          nivel: 'INFO',
          mensagem: 'Mensagem WhatsApp enviada com sucesso',
          contextoJson: {
            mensagem_id: mensagemId,
            telefone: mensagem.telefone,
            template: mensagem.template,
            tentativa: mensagem.tentativas + 1,
          },
        },
      });

    } catch (error) {
      // Erro no envio
      const proximoStatus = mensagem.tentativas + 1 >= this.maxTentativas ? 'FALHOU_DEFINITIVO' : 'ERRO';

      await this.prisma.mensagemViicio.update({
        where: { id: mensagemId },
        data: {
          status: proximoStatus,
          respostaJson: {
            erro: error.message,
            timestamp: new Date().toISOString(),
            tentativa: mensagem.tentativas + 1,
          },
        },
      });

      this.logger.error(`Erro no envio da mensagem ${mensagemId} (tentativa ${mensagem.tentativas + 1})`, error);

      // Log de erro
      await this.prisma.logSistema.create({
        data: {
          modulo: 'VIICIO',
          nivel: 'ERROR',
          mensagem: 'Erro no envio de mensagem WhatsApp',
          contextoJson: {
            mensagem_id: mensagemId,
            telefone: mensagem.telefone,
            template: mensagem.template,
            tentativa: mensagem.tentativas + 1,
            erro: error.message,
          },
        },
      });

      throw error;
    }
  }

  async testarConexao(dto: TesteMensagemDto): Promise<any> {
    if (!this.habilitado) {
      throw new BadRequestException('Serviço de mensagens está desabilitado');
    }

    const payload = {
      numero: this.formatarTelefone(dto.telefone),
      mensagem: dto.mensagem,
      tipo: 'teste',
    };

    try {
      const resposta = await this.chamarAPIViicio(payload);
      
      // Log do teste
      await this.prisma.logSistema.create({
        data: {
          modulo: 'VIICIO',
          nivel: 'INFO',
          mensagem: 'Teste de conexão Viicio realizado',
          contextoJson: {
            telefone: dto.telefone,
            sucesso: true,
            resposta: resposta,
          },
        },
      });

      return {
        sucesso: true,
        mensagem: 'Teste realizado com sucesso',
        resposta,
      };

    } catch (error) {
      // Log do erro
      await this.prisma.logSistema.create({
        data: {
          modulo: 'VIICIO',
          nivel: 'ERROR',
          mensagem: 'Falha no teste de conexão Viicio',
          contextoJson: {
            telefone: dto.telefone,
            sucesso: false,
            erro: error.message,
          },
        },
      });

      return {
        sucesso: false,
        mensagem: 'Falha no teste',
        erro: error.message,
      };
    }
  }

  async obterConfiguracoes(): Promise<ConfiguracaoViicioDto> {
    return {
      apiUrl: this.apiUrl,
      apiToken: this.apiToken ? '***configurado***' : '',
      habilitado: this.habilitado,
      timeout: this.timeout,
      maxTentativas: this.maxTentativas,
    };
  }

  async listarTemplates(): Promise<TemplateViicioDto[]> {
    return Object.values(this.templatesPadrao);
  }

  async obterTemplate(nomeTemplate: string): Promise<TemplateViicioDto | null> {
    const template = this.templatesPadrao[nomeTemplate];
    return template || null;
  }

  async listarMensagens(page = 1, limit = 20, status?: string): Promise<any> {
    const skip = (page - 1) * limit;
    
    const where = status ? { status } : {};

    const [mensagens, total] = await Promise.all([
      this.prisma.mensagemViicio.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          atendimento: {
            select: {
              protocolo: true,
              paciente: {
                select: { nome: true },
              },
            },
          },
        },
      }),
      this.prisma.mensagemViicio.count({ where }),
    ]);

    return {
      data: mensagens,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async obterRelatorio(): Promise<RelatorioMensagensDto> {
    const [total, enviadas, erros, pendentes, porStatus, porTemplate] = await Promise.all([
      this.prisma.mensagemViicio.count(),
      this.prisma.mensagemViicio.count({ where: { status: 'ENVIADO' } }),
      this.prisma.mensagemViicio.count({ where: { status: { in: ['ERRO', 'FALHOU_DEFINITIVO'] } } }),
      this.prisma.mensagemViicio.count({ where: { status: { in: ['PENDENTE', 'ENVIANDO'] } } }),
      
      // Contar por status
      this.prisma.mensagemViicio.groupBy({
        by: ['status'],
        _count: { id: true },
      }).then(results => 
        results.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>)
      ),
      
      // Contar por template
      this.prisma.mensagemViicio.groupBy({
        by: ['template'],
        _count: { id: true },
      }).then(results => 
        results.reduce((acc, item) => {
          acc[item.template] = item._count.id;
          return acc;
        }, {} as Record<string, number>)
      ),
    ]);

    const taxaSucesso = total > 0 ? ((enviadas / total) * 100).toFixed(2) : '0';

    return {
      total,
      enviadas,
      erros,
      pendentes,
      taxaSucesso: `${taxaSucesso}%`,
      porStatus,
      porTemplate,
    };
  }

  async reprocessarMensagensPendentes(): Promise<void> {
    const mensagensPendentes = await this.prisma.mensagemViicio.findMany({
      where: {
        status: { in: ['PENDENTE', 'ERRO'] },
        tentativas: { lt: this.maxTentativas },
      },
      take: 50, // Processar em lotes para não sobrecarregar
    });

    this.logger.log(`Reprocessando ${mensagensPendentes.length} mensagens pendentes`);

    for (const mensagem of mensagensPendentes) {
      try {
        await this.processarEnvio(mensagem.id);
        // Pequena pausa entre envios para não saturar a API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(`Erro ao reprocessar mensagem ${mensagem.id}`, error);
      }
    }
  }

  // MÉTODOS PRIVADOS

  private async chamarAPIViicio(payload: any): Promise<any> {
    if (!this.apiUrl || !this.apiToken) {
      throw new Error('Configuração da API Viicio incompleta');
    }

    const config = {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: this.timeout,
    };

    // Mock da integração se estivermos em modo de desenvolvimento/teste
    if (this.configService.get<string>('MOCK_VIICIO') === 'true') {
      return this.mockAPIViicio(payload);
    }

    const response = await firstValueFrom(
      this.httpService.post(`${this.apiUrl}/v1/mensagens`, payload, config)
    );

    return response.data;
  }

  private mockAPIViicio(payload: any): any {
    // Simular resposta da API para desenvolvimento/testes
    return {
      sucesso: true,
      mensagem_id: `mock_${Date.now()}`,
      status: 'enviado',
      timestamp: new Date().toISOString(),
      payload_recebido: payload,
    };
  }

  private construirPayloadAPI(mensagem: any): any {
    const mensagemProcessada = mensagem.payloadJson.mensagem_processada;
    
    return {
      numero: mensagem.telefone,
      mensagem: mensagemProcessada,
      tipo: 'texto',
      template: mensagem.template,
      metadata: {
        atendimento_id: mensagem.atendimentoId,
        sistema: 'laboratorio-autoatendimento',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private processarTemplate(template: string, variaveis: Record<string, any>): string {
    let mensagem = template;
    
    for (const [chave, valor] of Object.entries(variaveis)) {
      const placeholder = `{{${chave}}}`;
      mensagem = mensagem.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), String(valor || ''));
    }

    // Remover placeholders não substituídos
    mensagem = mensagem.replace(/\{\{[^}]+\}\}/g, '[não informado]');

    return mensagem;
  }

  private formatarTelefone(telefone: string): string {
    // Remover caracteres não numéricos
    const numerosApenas = telefone.replace(/\D/g, '');
    
    // Garantir formato internacional brasileiro
    if (numerosApenas.length === 11 && numerosApenas.startsWith('0')) {
      return `55${numerosApenas.substring(1)}`;
    } else if (numerosApenas.length === 11) {
      return `55${numerosApenas}`;
    } else if (numerosApenas.length === 13 && numerosApenas.startsWith('55')) {
      return numerosApenas;
    } else if (numerosApenas.length === 10) {
      return `5511${numerosApenas.substring(2)}`; // Assumir SP se não tiver DDD
    }
    
    return numerosApenas; // Retornar como está se não conseguir formatar
  }
}