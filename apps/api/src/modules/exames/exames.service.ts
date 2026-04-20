import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateExameDto, UpdateExameDto } from './dto/exames.dto';

@Injectable()
export class ExamesService {
  private readonly logger = new Logger(ExamesService.name);

  constructor(private prisma: PrismaService) {}

  async create(createExameDto: CreateExameDto, usuarioId: string) {
    const { nomePadrao, codigoInterno, codigoTuss, ...rest } = createExameDto;

    // Verificar se já existe exame com mesmo nome
    const exameExistente = await this.prisma.exame.findFirst({
      where: {
        nomePadrao: {
          equals: nomePadrao,
          mode: 'insensitive',
        },
      },
    });

    if (exameExistente) {
      throw new BadRequestException(`Já existe um exame cadastrado com o nome "${nomePadrao}"`);
    }

    // Verificar códigos únicos se fornecidos
    if (codigoInterno) {
      const codigoInternoExistente = await this.prisma.exame.findFirst({
        where: { codigoInterno },
      });
      if (codigoInternoExistente) {
        throw new BadRequestException(`Já existe um exame com código interno "${codigoInterno}"`);
      }
    }

    if (codigoTuss) {
      const codigoTussExistente = await this.prisma.exame.findFirst({
        where: { codigoTuss },
      });
      if (codigoTussExistente) {
        throw new BadRequestException(`Já existe um exame com código TUSS "${codigoTuss}"`);
      }
    }

    const exame = await this.prisma.exame.create({
      data: {
        nomePadrao,
        codigoInterno,
        codigoTuss,
        ...rest,
      },
    });

    // Log da criação
    await this.prisma.logSistema.create({
      data: {
        modulo: 'EXAMES',
        nivel: 'INFO',
        mensagem: 'Exame criado com sucesso',
        contextoJson: {
          exame_id: exame.id,
          nome_padrao: exame.nomePadrao,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    this.logger.log(`Exame criado: ${exame.nomePadrao} (ID: ${exame.id})`);
    return exame;
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { nomePadrao: { contains: search, mode: 'insensitive' as const } },
        { codigoInterno: { contains: search, mode: 'insensitive' as const } },
        { codigoTuss: { contains: search, mode: 'insensitive' as const } },
        { setor: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [exames, total] = await Promise.all([
      this.prisma.exame.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nomePadrao: 'asc' },
        include: {
          _count: {
            select: { sinonimos: true },
          },
        },
      }),
      this.prisma.exame.count({ where }),
    ]);

    // Adicionar total de sinônimos a cada exame
    const examensComSinonimos = exames.map(exame => ({
      ...exame,
      totalSinonimos: exame._count.sinonimos,
      _count: undefined,
    }));

    return {
      data: examensComSinonimos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const exame = await this.prisma.exame.findUnique({
      where: { id },
      include: {
        sinonimos: {
          include: {
            criadoPorUsuario: {
              select: { nome: true, email: true },
            },
            medico: {
              select: { nome: true, crm: true },
            },
            convenio: {
              select: { nome: true, codigo: true },
            },
          },
        },
        _count: {
          select: {
            sinonimos: true,
            atendimentoExames: true,
          },
        },
      },
    });

    if (!exame) {
      throw new NotFoundException(`Exame com ID ${id} não encontrado`);
    }

    return {
      ...exame,
      totalSinonimos: exame._count.sinonimos,
      totalAtendimentos: exame._count.atendimentoExames,
    };
  }

  async update(id: string, updateExameDto: UpdateExameDto, usuarioId: string) {
    const exameExistente = await this.prisma.exame.findUnique({
      where: { id },
    });

    if (!exameExistente) {
      throw new NotFoundException(`Exame com ID ${id} não encontrado`);
    }

    const { nomePadrao, codigoInterno, codigoTuss } = updateExameDto;

    // Verificar unicidade do nome (exceto o próprio registro)
    if (nomePadrao && nomePadrao !== exameExistente.nomePadrao) {
      const nomeExistente = await this.prisma.exame.findFirst({
        where: {
          nomePadrao: {
            equals: nomePadrao,
            mode: 'insensitive',
          },
          NOT: { id },
        },
      });
      if (nomeExistente) {
        throw new BadRequestException(`Já existe um exame cadastrado com o nome "${nomePadrao}"`);
      }
    }

    // Verificar unicidade dos códigos (exceto o próprio registro)
    if (codigoInterno && codigoInterno !== exameExistente.codigoInterno) {
      const codigoInternoExistente = await this.prisma.exame.findFirst({
        where: { codigoInterno, NOT: { id } },
      });
      if (codigoInternoExistente) {
        throw new BadRequestException(`Já existe um exame com código interno "${codigoInterno}"`);
      }
    }

    if (codigoTuss && codigoTuss !== exameExistente.codigoTuss) {
      const codigoTussExistente = await this.prisma.exame.findFirst({
        where: { codigoTuss, NOT: { id } },
      });
      if (codigoTussExistente) {
        throw new BadRequestException(`Já existe um exame com código TUSS "${codigoTuss}"`);
      }
    }

    const exameAtualizado = await this.prisma.exame.update({
      where: { id },
      data: updateExameDto,
    });

    // Log da atualização
    await this.prisma.logSistema.create({
      data: {
        modulo: 'EXAMES',
        nivel: 'INFO',
        mensagem: 'Exame atualizado com sucesso',
        contextoJson: {
          exame_id: id,
          alteracoes: updateExameDto,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    this.logger.log(`Exame atualizado: ${exameAtualizado.nomePadrao} (ID: ${id})`);
    return exameAtualizado;
  }

  async remove(id: string, usuarioId: string) {
    const exame = await this.prisma.exame.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            atendimentoExames: true,
            sinonimos: true,
          },
        },
      },
    });

    if (!exame) {
      throw new NotFoundException(`Exame com ID ${id} não encontrado`);
    }

    // Verificar se há atendimentos vinculados
    if (exame._count.atendimentoExames > 0) {
      throw new BadRequestException(
        `Não é possível excluir o exame "${exame.nomePadrao}" pois existem ${exame._count.atendimentoExames} atendimentos vinculados`
      );
    }

    // Em vez de deletar, desativar o exame
    const exameDesativado = await this.prisma.exame.update({
      where: { id },
      data: { ativo: false },
    });

    // Log da desativação
    await this.prisma.logSistema.create({
      data: {
        modulo: 'EXAMES',
        nivel: 'WARN',
        mensagem: 'Exame desativado',
        contextoJson: {
          exame_id: id,
          nome_padrao: exame.nomePadrao,
          usuario_id: usuarioId,
          total_sinonimos: exame._count.sinonimos,
        },
        usuarioId,
      },
    });

    this.logger.warn(`Exame desativado: ${exame.nomePadrao} (ID: ${id})`);
    return exameDesativado;
  }

  async activate(id: string, usuarioId: string) {
    const exame = await this.prisma.exame.findUnique({
      where: { id },
    });

    if (!exame) {
      throw new NotFoundException(`Exame com ID ${id} não encontrado`);
    }

    const exameAtivado = await this.prisma.exame.update({
      where: { id },
      data: { ativo: true },
    });

    // Log da ativação
    await this.prisma.logSistema.create({
      data: {
        modulo: 'EXAMES',
        nivel: 'INFO',
        mensagem: 'Exame reativado',
        contextoJson: {
          exame_id: id,
          nome_padrao: exame.nomePadrao,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    this.logger.log(`Exame reativado: ${exame.nomePadrao} (ID: ${id})`);
    return exameAtivado;
  }

  async buscarPorTexto(texto: string) {
    // Busca fuzzy nos sinônimos e nomes de exames
    const examespornome = await this.prisma.exame.findMany({
      where: {
        AND: [
          { ativo: true },
          {
            OR: [
              { nomePadrao: { contains: texto, mode: 'insensitive' } },
              { codigoInterno: { contains: texto, mode: 'insensitive' } },
              { codigoTuss: { contains: texto, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: {
        sinonimos: {
          where: { ativo: true },
        },
      },
    });

    // Buscar por sinônimos
    const examesPorSinonimos = await this.prisma.sinonimoExame.findMany({
      where: {
        AND: [
          { ativo: true },
          { descricaoVariacao: { contains: texto, mode: 'insensitive' } },
          { exame: { ativo: true } },
        ],
      },
      include: {
        exame: true,
      },
    });

    // Combinar resultados e remover duplicatas
    const examesEncontrados = new Map();

    examespornome.forEach(exame => {
      examesEncontrados.set(exame.id, {
        exame,
        matchType: 'nome',
        matchText: texto,
      });
    });

    examesPorSinonimos.forEach(sinonimo => {
      if (!examesEncontrados.has(sinonimo.exame.id)) {
        examesEncontrados.set(sinonimo.exame.id, {
          exame: sinonimo.exame,
          matchType: 'sinonimo',
          matchText: sinonimo.descricaoVariacao,
          sinonimo: sinonimo,
        });
      }
    });

    return Array.from(examesEncontrados.values());
  }
}