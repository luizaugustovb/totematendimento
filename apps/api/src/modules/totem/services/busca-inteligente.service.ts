import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

/**
 * Serviço de busca inteligente de exames e médicos
 * Usa normalização, sinônimos e algoritmos de similaridade
 */
@Injectable()
export class BuscaInteligenteService {
  private readonly logger = new Logger(BuscaInteligenteService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Busca exames por texto OCR com normalização e sinônimos
   */
  async buscarExames(textoOcr: string, limit: number = 10) {
    const textoNormalizado = this.normalizarTexto(textoOcr);
    const palavras = textoNormalizado.split(/\s+/);

    this.logger.log(`Buscando exames para: "${textoOcr}" (normalizado: "${textoNormalizado}")`);

    const resultados = [];

    // 1. Busca por nome exato (case insensitive)
    const examePorNome = await this.prisma.exame.findFirst({
      where: {
        nomePadrao: {
          equals: textoOcr,
          mode: 'insensitive',
        },
        ativo: true,
      },
      include: {
        sinonimos: true,
      },
    });

    if (examePorNome) {
      resultados.push({
        exame: examePorNome,
        score: 1.0,
        matchTipo: 'EXATO',
        matchOrigem: 'NOME_PADRAO',
      });
    }

    // 2. Busca por sinônimos exatos
    const sinonimosExatos = await this.prisma.sinonimoExame.findMany({
      where: {
        descricaoVariacao: {
          equals: textoOcr,
          mode: 'insensitive',
        },
        ativo: true,
      },
      include: {
        exame: true,
      },
      take: limit,
    });

    for (const sinonimo of sinonimosExatos) {
      if (!resultados.find(r => r.exame.id === sinonimo.exame.id)) {
        resultados.push({
          exame: sinonimo.exame,
          score: 0.95,
          matchTipo: 'EXATO',
          matchOrigem: 'SINONIMO',
          sinonimo: sinonimo.descricaoVariacao,
        });
      }
    }

    // 3. Busca por palavras-chave (CONTAINS)
    if (palavras.length > 0) {
      const examesPorPalavra = await this.prisma.exame.findMany({
        where: {
          OR: palavras.map(palavra => ({
            nomePadrao: {
              contains: palavra,
              mode: 'insensitive',
            },
          })),
          ativo: true,
        },
        include: {
          sinonimos: true,
        },
        take: limit,
      });

      for (const exame of examesPorPalavra) {
        if (!resultados.find(r => r.exame.id === exame.id)) {
          const score = this.calcularScoreSimilaridade(textoNormalizado, this.normalizarTexto(exame.nomePadrao));
          resultados.push({
            exame,
            score,
            matchTipo: 'CONTEM',
            matchOrigem: 'NOME_PADRAO',
          });
        }
      }
    }

    // 4. Busca fuzzy em sinônimos
    const todosSinonimos = await this.prisma.sinonimoExame.findMany({
      where: {
        OR: palavras.map(palavra => ({
          descricaoVariacao: {
            contains: palavra,
            mode: 'insensitive',
          },
        })),
        ativo: true,
      },
      include: {
        exame: true,
      },
      take: limit * 2,
    });

    for (const sinonimo of todosSinonimos) {
      if (!resultados.find(r => r.exame.id === sinonimo.exame.id)) {
        const score = this.calcularScoreSimilaridade(
          textoNormalizado,
          this.normalizarTexto(sinonimo.descricaoVariacao)
        );
        
        if (score >= 0.6) {
          resultados.push({
            exame: sinonimo.exame,
            score,
            matchTipo: 'FUZZY',
            matchOrigem: 'SINONIMO',
            sinonimo: sinonimo.descricaoVariacao,
          });
        }
      }
    }

    // Ordenar por score e limitar resultados
    const resultadosOrdenados = resultados
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    this.logger.log(`Encontrados ${resultadosOrdenados.length} exames`);

    return resultadosOrdenados;
  }

  /**
   * Busca médicos por nome e CRM
   */
  async buscarMedicos(nome?: string, crm?: string, uf?: string, limit: number = 10) {
    const whereConditions: any = {};

    if (nome) {
      const nomeNormalizado = this.normalizarTexto(nome);
      const palavras = nomeNormalizado.split(/\s+/);

      whereConditions.OR = [
        {
          nome: {
            contains: nome,
            mode: 'insensitive',
          },
        },
        ...palavras.map(palavra => ({
          nome: {
            contains: palavra,
            mode: 'insensitive',
          },
        })),
      ];
    }

    if (crm) {
      const crmLimpo = crm.replace(/[^\d]/g, '');
      whereConditions.crm = {
        contains: crmLimpo,
      };
    }

    if (uf) {
      whereConditions.ufCrm = {
        equals: uf.toUpperCase(),
      };
    }

    const medicos = await this.prisma.medico.findMany({
      where: whereConditions,
      take: limit,
      orderBy: {
        nome: 'asc',
      },
    });

    // Calcular score de similaridade se busca por nome
    if (nome) {
      const nomeNormalizado = this.normalizarTexto(nome);
      return medicos.map(medico => ({
        medico,
        score: this.calcularScoreSimilaridade(nomeNormalizado, this.normalizarTexto(medico.nome)),
      }))
      .sort((a, b) => b.score - a.score);
    }

    return medicos.map(medico => ({ medico, score: 1.0 }));
  }

  /**
   * Normaliza texto para comparação
   */
  private normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, '') // Remove pontuação
      .replace(/\s+/g, ' ') // Remove espaços duplos
      .trim();
  }

  /**
   * Calcula similaridade entre dois textos usando Levenshtein simplificado
   */
  private calcularScoreSimilaridade(texto1: string, texto2: string): number {
    // Casos especiais
    if (texto1 === texto2) return 1.0;
    if (!texto1 || !texto2) return 0.0;

    // Verifica se um contém o outro
    if (texto1.includes(texto2) || texto2.includes(texto1)) {
      const menorTamanho = Math.min(texto1.length, texto2.length);
      const maiorTamanho = Math.max(texto1.length, texto2.length);
      return menorTamanho / maiorTamanho;
    }

    // Calcula palavras em comum
    const palavras1 = new Set(texto1.split(/\s+/));
    const palavras2 = new Set(texto2.split(/\s+/));
    
    const palavrasComum = new Set([...palavras1].filter(p => palavras2.has(p)));
    const totalPalavras = Math.max(palavras1.size, palavras2.size);
    
    if (totalPalavras === 0) return 0.0;
    
    return palavrasComum.size / totalPalavras;
  }

  /**
   * Sugerir exames quando não encontrado (busca mais ampla)
   */
  async sugerirExames(textoOcr: string, limit: number = 5) {
    const palavras = this.normalizarTexto(textoOcr).split(/\s+/);
    
    if (palavras.length === 0) return [];

    // Busca mais ampla: qualquer palavra
    const sugestoes = await this.prisma.exame.findMany({
      where: {
        OR: [
          ...palavras.map(palavra => ({
            nomePadrao: {
              contains: palavra,
              mode: 'insensitive',
            },
          })),
          {
            sinonimos: {
              some: {
                OR: palavras.map(palavra => ({
                  descricaoVariacao: {
                    contains: palavra,
                    mode: 'insensitive',
                  },
                })),
                ativo: true,
              },
            },
          },
        ],
        ativo: true,
      },
      include: {
        sinonimos: {
          where: { ativo: true },
          take: 3,
        },
      },
      take: limit * 2,
    });

    // Calcular score e ordenar
    const sugestoesComScore = sugestoes.map(exame => ({
      exame,
      score: this.calcularScoreSimilaridade(
        this.normalizarTexto(textoOcr),
        this.normalizarTexto(exame.nomePadrao)
      ),
    }));

    return sugestoesComScore
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Adicionar sinônimo manualmente (aprendizado)
   */
  async adicionarSinonimo(
    exameId: string,
    descricaoVariacao: string,
    criadoPorUsuarioId: string,
    medicoId?: string,
    convenioId?: string,
  ) {
    const escopo = medicoId ? 'MEDICO' : convenioId ? 'CONVENIO' : 'GLOBAL';

    const sinonimo = await this.prisma.sinonimoExame.create({
      data: {
        exameId,
        descricaoVariacao: descricaoVariacao.trim(),
        escopo,
        medicoId,
        convenioId,
        tipoMatch: 'EXATO',
        criadoPorUsuarioId,
        ativo: true,
      },
      include: {
        exame: true,
      },
    });

    this.logger.log(`✅ Sinônimo adicionado: "${descricaoVariacao}" → ${sinonimo.exame.nomePadrao}`);

    return sinonimo;
  }

  /**
   * Listar sinônimos de um exame
   */
  async listarSinonimosExame(exameId: string) {
    return this.prisma.sinonimoExame.findMany({
      where: {
        exameId,
        ativo: true,
      },
      include: {
        exame: true,
        medico: true,
        convenio: true,
        criadoPorUsuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Remover sinônimo
   */
  async removerSinonimo(sinonimoId: string) {
    return this.prisma.sinonimoExame.update({
      where: { id: sinonimoId },
      data: { ativo: false },
    });
  }
}
