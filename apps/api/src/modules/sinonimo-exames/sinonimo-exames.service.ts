import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateSinonimoExameDto,
  UpdateSinonimoExameDto,
  NormalizarExameDto,
  ResultadoNormalizacaoDto,
  EscopoSinonimo,
  TipoMatch,
} from './dto/sinonimo-exames.dto';
import * as Fuse from 'fuse.js';

@Injectable()
export class SinonimoExamesService {
  private readonly logger = new Logger(SinonimoExamesService.name);

  constructor(private prisma: PrismaService) {}

  async create(createSinonimoDto: CreateSinonimoExameDto, usuarioId: string) {
    const { escopo, medicoId, convenioId, exameId, descricaoVariacao } = createSinonimoDto;

    // Validações de escopo
    if (escopo === EscopoSinonimo.MEDICO && !medicoId) {
      throw new BadRequestException('medicoId é obrigatório quando escopo for MEDICO');
    }
    if (escopo === EscopoSinonimo.CONVENIO && !convenioId) {
      throw new BadRequestException('convenioId é obrigatório quando escopo for CONVENIO');
    }
    if (escopo === EscopoSinonimo.GLOBAL && (medicoId || convenioId)) {
      throw new BadRequestException('medicoId e convenioId devem ser nulos quando escopo for GLOBAL');
    }

    // Verificar se o exame existe
    const exame = await this.prisma.exame.findUnique({ where: { id: exameId } });
    if (!exame) {
      throw new NotFoundException(`Exame com ID ${exameId} não encontrado`);
    }

    // Verificar se já existe sinônimo igual no mesmo escopo
    const sinonimoExistente = await this.prisma.sinonimoExame.findFirst({
      where: {
        exameId,
        descricaoVariacao: {
          equals: descricaoVariacao.toLowerCase().trim(),
          mode: 'insensitive',
        },
        escopo,
        medicoId: medicoId || null,
        convenioId: convenioId || null,
      },
    });

    if (sinonimoExistente) {
      throw new BadRequestException(
        `Já existe um sinônimo "${descricaoVariacao}" para este exame no escopo especificado`
      );
    }

    const sinonimo = await this.prisma.sinonimoExame.create({
      data: {
        ...createSinonimoDto,
        descricaoVariacao: descricaoVariacao.toLowerCase().trim(),
        criadoPorUsuarioId: usuarioId,
      },
      include: {
        exame: { select: { nomePadrao: true, codigoInterno: true } },
        medico: { select: { nome: true, crm: true } },
        convenio: { select: { nome: true, codigo: true } },
        criadoPorUsuario: { select: { nome: true, email: true } },
      },
    });

    // Log da criação
    await this.prisma.logSistema.create({
      data: {
        modulo: 'SINONIMOS',
        nivel: 'INFO',
        mensagem: 'Sinônimo criado com sucesso',
        contextoJson: {
          sinonimo_id: sinonimo.id,
          exame_nome: exame.nomePadrao,
          descricao_variacao: descricaoVariacao,
          escopo,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    this.logger.log(`Sinônimo criado: "${descricaoVariacao}" -> ${exame.nomePadrao}`);
    return sinonimo;
  }

  async findAll(page = 1, limit = 20, search?: string, exameId?: string) {
    const skip = (page - 1) * limit;
    
    const where: any = {};

    if (search) {
      where.OR = [
        { descricaoVariacao: { contains: search, mode: 'insensitive' } },
        { exame: { nomePadrao: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (exameId) {
      where.exameId = exameId;
    }

    const [sinonimos, total] = await Promise.all([
      this.prisma.sinonimoExame.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ escopo: 'asc' }, { descricaoVariacao: 'asc' }],
        include: {
          exame: { select: { id: true, nomePadrao: true, codigoInterno: true } },
          medico: { select: { id: true, nome: true, crm: true } },
          convenio: { select: { id: true, nome: true, codigo: true } },
          criadoPorUsuario: { select: { id: true, nome: true, email: true } },
        },
      }),
      this.prisma.sinonimoExame.count({ where }),
    ]);

    return {
      data: sinonimos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const sinonimo = await this.prisma.sinonimoExame.findUnique({
      where: { id },
      include: {
        exame: { select: { id: true, nomePadrao: true, codigoInterno: true, codigoTuss: true } },
        medico: { select: { id: true, nome: true, crm: true, ufCrm: true } },
        convenio: { select: { id: true, nome: true, codigo: true } },
        criadoPorUsuario: { select: { id: true, nome: true, email: true } },
      },
    });

    if (!sinonimo) {
      throw new NotFoundException(`Sinônimo com ID ${id} não encontrado`);
    }

    return sinonimo;
  }

  async update(id: string, updateSinonimoDto: UpdateSinonimoExameDto, usuarioId: string) {
    const sinonimoExistente = await this.prisma.sinonimoExame.findUnique({
      where: { id },
      include: { exame: { select: { nomePadrao: true } } },
    });

    if (!sinonimoExistente) {
      throw new NotFoundException(`Sinônimo com ID ${id} não encontrado`);
    }

    const { escopo, medicoId, convenioId, descricaoVariacao } = updateSinonimoDto;

    // Validações de escopo
    if (escopo === EscopoSinonimo.MEDICO && !medicoId) {
      throw new BadRequestException('medicoId é obrigatório quando escopo for MEDICO');
    }
    if (escopo === EscopoSinonimo.CONVENIO && !convenioId) {
      throw new BadRequestException('convenioId é obrigatório quando escopo for CONVENIO');
    }

    const sinonimo = await this.prisma.sinonimoExame.update({
      where: { id },
      data: {
        ...updateSinonimoDto,
        descricaoVariacao: descricaoVariacao?.toLowerCase().trim(),
      },
      include: {
        exame: { select: { nomePadrao: true, codigoInterno: true } },
        medico: { select: { nome: true, crm: true } },
        convenio: { select: { nome: true, codigo: true } },
        criadoPorUsuario: { select: { nome: true, email: true } },
      },
    });

    // Log da atualização
    await this.prisma.logSistema.create({
      data: {
        modulo: 'SINONIMOS',
        nivel: 'INFO',
        mensagem: 'Sinônimo atualizado com sucesso',
        contextoJson: {
          sinonimo_id: id,
          exame_nome: sinonimoExistente.exame.nomePadrao,
          alteracoes: updateSinonimoDto,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    return sinonimo;
  }

  async remove(id: string, usuarioId: string) {
    const sinonimo = await this.prisma.sinonimoExame.findUnique({
      where: { id },
      include: { exame: { select: { nomePadrao: true } } },
    });

    if (!sinonimo) {
      throw new NotFoundException(`Sinônimo com ID ${id} não encontrado`);
    }

    await this.prisma.sinonimoExame.delete({ where: { id } });

    // Log da exclusão
    await this.prisma.logSistema.create({
      data: {
        modulo: 'SINONIMOS',
        nivel: 'WARN',
        mensagem: 'Sinônimo excluído',
        contextoJson: {
          sinonimo_id: id,
          exame_nome: sinonimo.exame.nomePadrao,
          descricao_variacao: sinonimo.descricaoVariacao,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    return { message: 'Sinônimo excluído com sucesso' };
  }

  /**
   * NÚCLEO DO SISTEMA: Normalização de exames com múltiplas estratégias
   */
  async normalizarExame(dto: NormalizarExameDto): Promise<ResultadoNormalizacaoDto> {
    const { texto, medicoId, convenioId } = dto;
    const textoLimpo = texto.toLowerCase().trim();

    // 1. MATCH EXATO POR MÉDICO (maior prioridade)
    if (medicoId) {
      const matchMedico = await this.matchPorEscopo(textoLimpo, EscopoSinonimo.MEDICO, medicoId);
      if (matchMedico.encontrado) {
        return matchMedico;
      }
    }

    // 2. MATCH EXATO POR CONVÊNIO
    if (convenioId) {
      const matchConvenio = await this.matchPorEscopo(textoLimpo, EscopoSinonimo.CONVENIO, null, convenioId);
      if (matchConvenio.encontrado) {
        return matchConvenio;
      }
    }

    // 3. MATCH EXATO GLOBAL
    const matchGlobal = await this.matchPorEscopo(textoLimpo, EscopoSinonimo.GLOBAL);
    if (matchGlobal.encontrado) {
      return matchGlobal;
    }

    // 4. MATCH DIRETO NO NOME DO EXAME
    const matchNomeExame = await this.matchNomeExameDireto(textoLimpo);
    if (matchNomeExame.encontrado) {
      return matchNomeExame;
    }

    // 5. FUZZY MATCH NOS SINÔNIMOS
    const fuzzyMatch = await this.fuzzyMatchSinonimos(textoLimpo, medicoId, convenioId);
    if (fuzzyMatch.encontrado && fuzzyMatch.scoreConfianca >= 0.7) {
      return fuzzyMatch;
    }

    // 6. FUZZY MATCH NOS NOMES DE EXAMES
    const fuzzyMatchExames = await this.fuzzyMatchExames(textoLimpo);
    if (fuzzyMatchExames.encontrado && fuzzyMatchExames.scoreConfianca >= 0.7) {
      return fuzzyMatchExames;
    }

    // TODO: 7. Match por IA (implementar quando integrar Claude)
    
    // Não encontrado
    return {
      encontrado: false,
      scoreConfianca: 0,
      origemMatch: 'nao_encontrado',
      textoNormalizado: textoLimpo,
    };
  }

  private async matchPorEscopo(
    texto: string,
    escopo: EscopoSinonimo,
    medicoId?: string,
    convenioId?: string
  ): Promise<ResultadoNormalizacaoDto> {
    const whereClause: any = {
      escopo,
      ativo: true,
      exame: { ativo: true },
    };

    if (medicoId) whereClause.medicoId = medicoId;
    if (convenioId) whereClause.convenioId = convenioId;

    // Match exato
    const matchExato = await this.prisma.sinonimoExame.findFirst({
      where: {
        ...whereClause,
        descricaoVariacao: texto,
        tipoMatch: { in: [TipoMatch.EXATO] },
      },
      include: {
        exame: {
          select: { id: true, nomePadrao: true, codigoInterno: true, codigoTuss: true },
        },
      },
    });

    if (matchExato) {
      return {
        encontrado: true,
        scoreConfianca: 1.0,
        origemMatch: `${escopo.toLowerCase()}_exato`,
        exame: matchExato.exame,
        sinonimo: {
          id: matchExato.id,
          descricaoVariacao: matchExato.descricaoVariacao,
          tipoMatch: matchExato.tipoMatch,
          escopo: matchExato.escopo,
        },
        textoNormalizado: matchExato.descricaoVariacao,
      };
    }

    // Match por conteúdo
    const matchContem = await this.prisma.sinonimoExame.findFirst({
      where: {
        ...whereClause,
        OR: [
          { descricaoVariacao: { contains: texto } },
          { descricaoVariacao: { in: [texto] } },
        ],
        tipoMatch: { in: [TipoMatch.CONTEM, TipoMatch.EXATO] },
      },
      include: {
        exame: {
          select: { id: true, nomePadrao: true, codigoInterno: true, codigoTuss: true },
        },
      },
    });

    if (matchContem) {
      const score = texto === matchContem.descricaoVariacao ? 1.0 : 0.8;
      return {
        encontrado: true,
        scoreConfianca: score,
        origemMatch: `${escopo.toLowerCase()}_contem`,
        exame: matchContem.exame,
        sinonimo: {
          id: matchContem.id,
          descricaoVariacao: matchContem.descricaoVariacao,
          tipoMatch: matchContem.tipoMatch,
          escopo: matchContem.escopo,
        },
        textoNormalizado: matchContem.descricaoVariacao,
      };
    }

    return { encontrado: false, scoreConfianca: 0, origemMatch: 'sem_match', textoNormalizado: texto };
  }

  private async matchNomeExameDireto(texto: string): Promise<ResultadoNormalizacaoDto> {
    const exame = await this.prisma.exame.findFirst({
      where: {
        ativo: true,
        OR: [
          { nomePadrao: { equals: texto, mode: 'insensitive' } },
          { codigoInterno: { equals: texto, mode: 'insensitive' } },
          { codigoTuss: { equals: texto, mode: 'insensitive' } },
        ],
      },
      select: { id: true, nomePadrao: true, codigoInterno: true, codigoTuss: true },
    });

    if (exame) {
      return {
        encontrado: true,
        scoreConfianca: 1.0,
        origemMatch: 'nome_exame_direto',
        exame,
        textoNormalizado: texto,
      };
    }

    return { encontrado: false, scoreConfianca: 0, origemMatch: 'sem_match', textoNormalizado: texto };
  }

  private async fuzzyMatchSinonimos(
    texto: string,
    medicoId?: string,
    convenioId?: string
  ): Promise<ResultadoNormalizacaoDto> {
    // Buscar todos os sinônimos ativos
    const whereClause: any = {
      ativo: true,
      exame: { ativo: true },
    };

    // Priorizar contexto específico
    if (medicoId || convenioId) {
      whereClause.OR = [
        { escopo: EscopoSinonimo.GLOBAL },
        ...(medicoId ? [{ escopo: EscopoSinonimo.MEDICO, medicoId }] : []),
        ...(convenioId ? [{ escopo: EscopoSinonimo.CONVENIO, convenioId }] : []),
      ];
    }

    const sinonimos = await this.prisma.sinonimoExame.findMany({
      where: whereClause,
      include: {
        exame: {
          select: { id: true, nomePadrao: true, codigoInterno: true, codigoTuss: true },
        },
      },
    });

    if (sinonimos.length === 0) {
      return { encontrado: false, scoreConfianca: 0, origemMatch: 'sem_dados', textoNormalizado: texto };
    }

    // Configurar Fuse.js para busca fuzzy
    const fuse = new Fuse(sinonimos, {
      keys: ['descricaoVariacao'],
      threshold: 0.4, // Limiar de similaridade
      distance: 100,
      minMatchCharLength: 2,
    });

    const results = fuse.search(texto);

    if (results.length > 0) {
      const melhorMatch = results[0];
      const score = 1 - melhorMatch.score; // Inverter score do Fuse.js

      if (score >= 0.6) {
        const sinonimo = melhorMatch.item;
        return {
          encontrado: true,
          scoreConfianca: score,
          origemMatch: 'fuzzy_sinonimos',
          exame: sinonimo.exame,
          sinonimo: {
            id: sinonimo.id,
            descricaoVariacao: sinonimo.descricaoVariacao,
            tipoMatch: sinonimo.tipoMatch,
            escopo: sinonimo.escopo,
          },
          textoNormalizado: sinonimo.descricaoVariacao,
        };
      }
    }

    return { encontrado: false, scoreConfianca: 0, origemMatch: 'fuzzy_baixo_score', textoNormalizado: texto };
  }

  private async fuzzyMatchExames(texto: string): Promise<ResultadoNormalizacaoDto> {
    const exames = await this.prisma.exame.findMany({
      where: { ativo: true },
      select: { id: true, nomePadrao: true, codigoInterno: true, codigoTuss: true },
    });

    const fuse = new Fuse(exames, {
      keys: ['nomePadrao', 'codigoInterno', 'codigoTuss'],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 2,
    });

    const results = fuse.search(texto);

    if (results.length > 0) {
      const melhorMatch = results[0];
      const score = 1 - melhorMatch.score;

      if (score >= 0.6) {
        return {
          encontrado: true,
          scoreConfianca: score,
          origemMatch: 'fuzzy_exames',
          exame: melhorMatch.item,
          textoNormalizado: texto,
        };
      }
    }

    return { encontrado: false, scoreConfianca: 0, origemMatch: 'fuzzy_baixo_score', textoNormalizado: texto };
  }

  async obterEstatisticas() {
    const [totalSinonimos, totalGlobais, totalMedicos, totalConvenios, totalExames] = await Promise.all([
      this.prisma.sinonimoExame.count({ where: { ativo: true } }),
      this.prisma.sinonimoExame.count({ where: { ativo: true, escopo: EscopoSinonimo.GLOBAL } }),
      this.prisma.sinonimoExame.count({ where: { ativo: true, escopo: EscopoSinonimo.MEDICO } }),
      this.prisma.sinonimoExame.count({ where: { ativo: true, escopo: EscopoSinonimo.CONVENIO } }),
      this.prisma.exame.count({ where: { ativo: true } }),
    ]);

    return {
      totalSinonimos,
      totalGlobais,
      totalMedicos,
      totalConvenios,
      totalExames,
      coberturaSinonimos: totalExames > 0 ? (totalSinonimos / totalExames).toFixed(2) : '0',
    };
  }
}