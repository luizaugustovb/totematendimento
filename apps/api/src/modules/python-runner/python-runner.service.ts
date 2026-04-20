import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { 
  CreateScriptPythonDto, 
  UpdateScriptPythonDto, 
  ExecutarScriptDto,
  ResultadoExecucaoDto
} from './dto/python-runner.dto';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class PythonRunnerService {
  private readonly logger = new Logger(PythonRunnerService.name);
  private readonly pythonExecutable: string;
  private readonly scriptsPath: string;
  private readonly defaultTimeout: number;
  private execucoesAtivas = new Map<string, ChildProcess>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.pythonExecutable = this.configService.get<string>('PYTHON_EXECUTABLE', 'python3');
    this.scriptsPath = this.configService.get<string>('PYTHON_SCRIPTS_PATH', './python-scripts');
    this.defaultTimeout = this.configService.get<number>('PYTHON_TIMEOUT_SECONDS', 60);
  }

  // CRUD Scripts Python
  
  async createScript(createScriptDto: CreateScriptPythonDto, usuarioId: string) {
    const { nome, caminho } = createScriptDto;

    // Verificar se nome é único
    const scriptExistente = await this.prisma.scriptPython.findUnique({
      where: { nome },
    });

    if (scriptExistente) {
      throw new BadRequestException(`Script com nome "${nome}" já existe`);
    }

    // Validar se o arquivo existe
    await this.validarArquivoScript(caminho);

    const script = await this.prisma.scriptPython.create({
      data: {
        ...createScriptDto,
        timeoutSegundos: createScriptDto.timeoutSegundos || this.defaultTimeout,
      },
    });

    // Log da criação
    await this.prisma.logSistema.create({
      data: {
        modulo: 'PYTHON_RUNNER',
        nivel: 'INFO',
        mensagem: 'Script Python cadastrado',
        contextoJson: {
          script_id: script.id,
          nome: script.nome,
          caminho: script.caminho,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    this.logger.log(`Script Python cadastrado: ${nome} (${caminho})`);
    return script;
  }

  async findAllScripts(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { nome: { contains: search, mode: 'insensitive' as const } },
        { caminho: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [scripts, total] = await Promise.all([
      this.prisma.scriptPython.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        include: {
          _count: {
            select: { execucoes: true },
          },
        },
      }),
      this.prisma.scriptPython.count({ where }),
    ]);

    const scriptsComContagem = scripts.map(script => ({
      ...script,
      totalExecucoes: script._count.execucoes,
      _count: undefined,
    }));

    return {
      data: scriptsComContagem,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneScript(id: string) {
    const script = await this.prisma.scriptPython.findUnique({
      where: { id },
      include: {
        execucoes: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            convenio: {
              select: { nome: true, codigo: true },
            },
          },
        },
        _count: {
          select: { execucoes: true },
        },
      },
    });

    if (!script) {
      throw new NotFoundException(`Script com ID ${id} não encontrado`);
    }

    return {
      ...script,
      totalExecucoes: script._count.execucoes,
    };
  }

  async updateScript(id: string, updateScriptDto: UpdateScriptPythonDto, usuarioId: string) {
    const scriptExistente = await this.prisma.scriptPython.findUnique({
      where: { id },
    });

    if (!scriptExistente) {
      throw new NotFoundException(`Script com ID ${id} não encontrado`);
    }

    // Validar arquivo se o caminho foi alterado
    if (updateScriptDto.caminho && updateScriptDto.caminho !== scriptExistente.caminho) {
      await this.validarArquivoScript(updateScriptDto.caminho);
    }

    const script = await this.prisma.scriptPython.update({
      where: { id },
      data: updateScriptDto,
    });

    // Log da atualização
    await this.prisma.logSistema.create({
      data: {
        modulo: 'PYTHON_RUNNER',
        nivel: 'INFO',
        mensagem: 'Script Python atualizado',
        contextoJson: {
          script_id: id,
          alteracoes: updateScriptDto,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    return script;
  }

  async removeScript(id: string, usuarioId: string) {
    const script = await this.prisma.scriptPython.findUnique({
      where: { id },
      include: {
        _count: {
          select: { execucoes: true },
        },
      },
    });

    if (!script) {
      throw new NotFoundException(`Script com ID ${id} não encontrado`);
    }

    // Verificar se há execuções pendentes/em andamento
    const execucoesPendentes = await this.prisma.execucaoPython.count({
      where: {
        scriptId: id,
        status: { in: ['PENDENTE', 'EXECUTANDO'] },
      },
    });

    if (execucoesPendentes > 0) {
      throw new BadRequestException(
        `Não é possível excluir o script "${script.nome}" pois há ${execucoesPendentes} execuções pendentes/em andamento`
      );
    }

    // Desativar em vez de excluir
    const scriptDesativado = await this.prisma.scriptPython.update({
      where: { id },
      data: { ativo: false },
    });

    // Log da desativação
    await this.prisma.logSistema.create({
      data: {
        modulo: 'PYTHON_RUNNER',
        nivel: 'WARN',
        mensagem: 'Script Python desativado',
        contextoJson: {
          script_id: id,
          nome: script.nome,
          total_execucoes: script._count.execucoes,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    return scriptDesativado;
  }

  // EXECUÇÃO DE SCRIPTS

  async executarScript(dto: ExecutarScriptDto): Promise<ResultadoExecucaoDto> {
    const { scriptId, atendimentoId, convenioId, parametrosJson } = dto;

    // Verificar se o script existe e está ativo
    const script = await this.prisma.scriptPython.findUnique({
      where: { id: scriptId, ativo: true },
    });

    if (!script) {
      throw new NotFoundException('Script não encontrado ou inativo');
    }

    // Validar parâmetros
    this.validarParametros(parametrosJson, script.parametrosPermitidosJson);

    // Criar registro da execução
    const execucao = await this.prisma.execucaoPython.create({
      data: {
        atendimentoId,
        scriptId,
        convenioId,
        parametrosJson,
        status: 'PENDENTE',
      },
    });

    try {
      // Executar script de forma assíncrona
      this.executarScriptAsync(execucao.id, script, parametrosJson);

      return {
        success: true,
        execucaoId: execucao.id,
        status: 'PENDENTE',
      };

    } catch (error) {
      // Atualizar status para erro
      await this.prisma.execucaoPython.update({
        where: { id: execucao.id },
        data: {
          status: 'ERRO',
          stderr: error.message,
          finishedAt: new Date(),
        },
      });

      return {
        success: false,
        execucaoId: execucao.id,
        status: 'ERRO',
        erro: error.message,
      };
    }
  }

  private async executarScriptAsync(execucaoId: string, script: any, parametros: any) {
    const startTime = Date.now();

    try {
      // Atualizar status para executando
      await this.prisma.execucaoPython.update({
        where: { id: execucaoId },
        data: {
          status: 'EXECUTANDO',
          startedAt: new Date(),
        },
      });

      // Preparar comando e argumentos
      const caminhoCompleto = path.resolve(script.caminho);
      const parametrosString = JSON.stringify(parametros);

      // Executar processo Python
      const processo = spawn(this.pythonExecutable, [caminhoCompleto, parametrosString], {
        cwd: this.scriptsPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: script.timeoutSegundos * 1000,
      });

      // Monitorar execução
      this.execucoesAtivas.set(execucaoId, processo);

      let stdout = '';
      let stderr = '';

      processo.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      processo.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      processo.on('close', async (code) => {
        this.execucoesAtivas.delete(execucaoId);
        const endTime = Date.now();
        const duracao = endTime - startTime;

        try {
          let resultado = null;
          
          // Tentar parsear saída como JSON
          if (stdout.trim()) {
            try {
              resultado = JSON.parse(stdout.trim());
            } catch {
              // Se não for JSON válido, manter como string
              resultado = { output: stdout.trim() };
            }
          }

          const status = code === 0 ? 'CONCLUIDO' : 'ERRO';

          await this.prisma.execucaoPython.update({
            where: { id: execucaoId },
            data: {
              status,
              stdout,
              stderr,
              codigoRetorno: code,
              finishedAt: new Date(),
            },
          });

          // Log do resultado
          const logLevel = code === 0 ? 'INFO' : 'ERROR';
          const logMessage = code === 0 ? 'Script executado com sucesso' : 'Script finalizado com erro';

          await this.prisma.logSistema.create({
            data: {
              modulo: 'PYTHON_RUNNER',
              nivel: logLevel,
              mensagem: logMessage,
              contextoJson: {
                execucao_id: execucaoId,
                script_nome: script.nome,
                codigo_retorno: code,
                duracao_ms: duracao,
                resultado: resultado,
              },
            },
          });

          this.logger.log(`Script ${script.nome} finalizado com código ${code} (${duracao}ms)`);

        } catch (error) {
          this.logger.error(`Erro ao processar resultado do script ${script.nome}`, error);
        }
      });

      processo.on('error', async (error) => {
        this.execucoesAtivas.delete(execucaoId);
        
        await this.prisma.execucaoPython.update({
          where: { id: execucaoId },
          data: {
            status: 'ERRO',
            stderr: error.message,
            finishedAt: new Date(),
          },
        });

        this.logger.error(`Erro na execução do script ${script.nome}`, error);
      });

    } catch (error) {
      await this.prisma.execucaoPython.update({
        where: { id: execucaoId },
        data: {
          status: 'ERRO',
          stderr: error.message,
          finishedAt: new Date(),
        },
      });

      this.logger.error(`Erro ao iniciar script ${script.nome}`, error);
    }
  }

  async cancelarExecucao(execucaoId: string, usuarioId: string) {
    const execucao = await this.prisma.execucaoPython.findUnique({
      where: { id: execucaoId },
    });

    if (!execucao) {
      throw new NotFoundException('Execução não encontrada');
    }

    if (!['PENDENTE', 'EXECUTANDO'].includes(execucao.status)) {
      throw new BadRequestException('Execução não pode ser cancelada no estado atual');
    }

    // Tentar matar o processo se estiver rodando
    const processo = this.execucoesAtivas.get(execucaoId);
    if (processo) {
      processo.kill('SIGTERM');
      this.execucoesAtivas.delete(execucaoId);
    }

    // Atualizar status
    await this.prisma.execucaoPython.update({
      where: { id: execucaoId },
      data: {
        status: 'CANCELADO',
        stderr: `Execução cancelada por usuário ${usuarioId}`,
        finishedAt: new Date(),
      },
    });

    // Log do cancelamento
    await this.prisma.logSistema.create({
      data: {
        modulo: 'PYTHON_RUNNER',
        nivel: 'WARN',
        mensagem: 'Execução de script cancelada',
        contextoJson: {
          execucao_id: execucaoId,
          usuario_id: usuarioId,
        },
        usuarioId,
      },
    });

    return { message: 'Execução cancelada com sucesso' };
  }

  // CONSULTA DE EXECUÇÕES

  async findAllExecucoes(page = 1, limit = 20, status?: string, scriptId?: string) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (scriptId) where.scriptId = scriptId;

    const [execucoes, total] = await Promise.all([
      this.prisma.execucaoPython.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          script: {
            select: { id: true, nome: true, caminho: true },
          },
          convenio: {
            select: { id: true, nome: true, codigo: true },
          },
        },
      }),
      this.prisma.execucaoPython.count({ where }),
    ]);

    // Calcular duração para execuções finalizadas
    const execucoesComDuracao = execucoes.map(execucao => {
      let duracao = null;
      if (execucao.startedAt && execucao.finishedAt) {
        duracao = execucao.finishedAt.getTime() - execucao.startedAt.getTime();
      }
      return { ...execucao, duracao };
    });

    return {
      data: execucoesComDuracao,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneExecucao(id: string) {
    const execucao = await this.prisma.execucaoPython.findUnique({
      where: { id },
      include: {
        script: {
          select: { id: true, nome: true, caminho: true, parametrosPermitidosJson: true },
        },
        convenio: {
          select: { id: true, nome: true, codigo: true },
        },
        atendimento: {
          select: { id: true, protocolo: true },
        },
      },
    });

    if (!execucao) {
      throw new NotFoundException(`Execução com ID ${id} não encontrada`);
    }

    // Calcular duração
    let duracao = null;
    if (execucao.startedAt && execucao.finishedAt) {
      duracao = execucao.finishedAt.getTime() - execucao.startedAt.getTime();
    }

    return { ...execucao, duracao };
  }

  async obterEstatisticasExecucoes() {
    const [total, concluidas, erros, pendentes, executando] = await Promise.all([
      this.prisma.execucaoPython.count(),
      this.prisma.execucaoPython.count({ where: { status: 'CONCLUIDO' } }),
      this.prisma.execucaoPython.count({ where: { status: 'ERRO' } }),
      this.prisma.execucaoPython.count({ where: { status: 'PENDENTE' } }),
      this.prisma.execucaoPython.count({ where: { status: 'EXECUTANDO' } }),
    ]);

    const taxaSucesso = total > 0 ? ((concluidas / total) * 100).toFixed(2) : '0';

    return {
      total,
      concluidas,
      erros,
      pendentes,
      executando,
      taxaSucesso: `${taxaSucesso}%`,
      execucoesAtivas: this.execucoesAtivas.size,
    };
  }

  // MÉTODOS PRIVADOS DE VALIDAÇÃO

  private async validarArquivoScript(caminho: string) {
    try {
      const caminhoCompleto = path.resolve(caminho);
      
      // Verificar se o arquivo existe
      await fs.access(caminhoCompleto);
      
      // Verificar extensão
      if (!caminhoCompleto.endsWith('.py')) {
        throw new BadRequestException('Arquivo deve ter extensão .py');
      }

      // Verificar se está dentro do diretório permitido
      const scriptsPathResolved = path.resolve(this.scriptsPath);
      if (!caminhoCompleto.startsWith(scriptsPathResolved)) {
        throw new BadRequestException('Arquivo deve estar dentro do diretório de scripts permitido');
      }

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new BadRequestException(`Arquivo não encontrado: ${caminho}`);
      }
      throw error;
    }
  }

  private validarParametros(parametros: Record<string, any>, parametrosPermitidos: Record<string, any>) {
    for (const [chave, valor] of Object.entries(parametros)) {
      if (!(chave in parametrosPermitidos)) {
        throw new BadRequestException(`Parâmetro '${chave}' não é permitido`);
      }

      const tipoEsperado = parametrosPermitidos[chave];
      const tipoRecebido = Array.isArray(valor) ? 'array' : typeof valor;

      if (tipoEsperado !== tipoRecebido) {
        throw new BadRequestException(
          `Parâmetro '${chave}' deve ser do tipo '${tipoEsperado}', recebido '${tipoRecebido}'`
        );
      }
    }
  }
}