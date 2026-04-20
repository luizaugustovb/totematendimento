import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SqlServerService } from './sql-server.service';

/**
 * Serviço de sincronização automática com SQL Server Legado
 * Sincroniza exames e médicos a cada 10 minutos
 */
@Injectable()
export class SyncLegadoService {
  private readonly logger = new Logger(SyncLegadoService.name);
  private sincronizandoExames = false;
  private sincronizandoMedicos = false;

  constructor(
    private prisma: PrismaService,
    private sqlServerService: SqlServerService,
  ) {}

  /**
   * Sincroniza exames a cada 10 minutos
   */
  @Cron('0 */10 * * * *') // A cada 10 minutos
  async sincronizarExames() {
    if (this.sincronizandoExames) {
      this.logger.warn('Sincronização de exames já em execução, pulando...');
      return;
    }

    this.sincronizandoExames = true;

    try {
      this.logger.log('🔄 Iniciando sincronização de EXAMES...');

      // Buscar última sincronização
      let ultimaSync = await this.prisma.sincronizacaoLegado.findUnique({
        where: { tabela: 'tipo_ex' },
      });

      const ultimoCodigo = ultimaSync?.ultimoCodigoSync || 0;

      this.logger.log(`Último código sincronizado: ${ultimoCodigo}`);

      // Buscar novos exames no SQL Server
      const novosExames = await this.buscarNovosExamesSqlServer(ultimoCodigo);

      if (novosExames.length === 0) {
        this.logger.log('✅ Nenhum exame novo encontrado');
        return;
      }

      this.logger.log(`📥 ${novosExames.length} novos exames encontrados`);

      // Inserir exames no PostgreSQL
      let inseridos = 0;
      let maiorCodigo = ultimoCodigo;

      for (const exame of novosExames) {
        try {
          await this.prisma.exame.upsert({
            where: { codExameLegado: exame.cod_exame },
            create: {
              codExameLegado: exame.cod_exame,
              nomePadrao: exame.descr_exame.trim(),
              codigoInterno: exame.cod_exame.toString(),
              ativo: true,
            },
            update: {
              nomePadrao: exame.descr_exame.trim(),
            },
          });

          inseridos++;
          if (exame.cod_exame > maiorCodigo) {
            maiorCodigo = exame.cod_exame;
          }
        } catch (error) {
          this.logger.error(`Erro ao inserir exame ${exame.cod_exame}:`, error.message);
        }
      }

      // Atualizar controle de sincronização
      await this.prisma.sincronizacaoLegado.upsert({
        where: { tabela: 'tipo_ex' },
        create: {
          tabela: 'tipo_ex',
          ultimoCodigoSync: maiorCodigo,
          totalRegistros: inseridos,
          ultimaSincronizacao: new Date(),
        },
        update: {
          ultimoCodigoSync: maiorCodigo,
          totalRegistros: { increment: inseridos },
          ultimaSincronizacao: new Date(),
        },
      });

      this.logger.log(`✅ Sincronização de exames concluída: ${inseridos} inseridos`);
    } catch (error) {
      this.logger.error('❌ Erro na sincronização de exames:', error);
    } finally {
      this.sincronizandoExames = false;
    }
  }

  /**
   * Sincroniza médicos a cada 10 minutos
   */
  @Cron('1 */10 * * * *') // A cada 10 minutos (1 minuto após os exames)
  async sincronizarMedicos() {
    if (this.sincronizandoMedicos) {
      this.logger.warn('Sincronização de médicos já em execução, pulando...');
      return;
    }

    this.sincronizandoMedicos = true;

    try {
      this.logger.log('🔄 Iniciando sincronização de MÉDICOS...');

      // Buscar última sincronização
      let ultimaSync = await this.prisma.sincronizacaoLegado.findUnique({
        where: { tabela: 'medico' },
      });

      const ultimoCodigo = ultimaSync?.ultimoCodigoSync || 0;

      this.logger.log(`Último código sincronizado: ${ultimoCodigo}`);

      // Buscar novos médicos no SQL Server
      const novosMedicos = await this.buscarNovosMedicosSqlServer(ultimoCodigo);

      if (novosMedicos.length === 0) {
        this.logger.log('✅ Nenhum médico novo encontrado');
        return;
      }

      this.logger.log(`📥 ${novosMedicos.length} novos médicos encontrados`);

      // Inserir médicos no PostgreSQL
      let inseridos = 0;
      let maiorCodigo = ultimoCodigo;

      for (const medico of novosMedicos) {
        try {
          // Validar dados
          if (!medico.crm_medico || !medico.uf_medico) {
            this.logger.warn(`Médico sem CRM/UF: ${medico.nome_medico}`);
            continue;
          }

          await this.prisma.medico.upsert({
            where: {
              crm_ufCrm: {
                crm: medico.crm_medico.trim(),
                ufCrm: medico.uf_medico.trim().toUpperCase(),
              },
            },
            create: {
              codMedicoLegado: medico.cod_medico,
              nome: medico.nome_medico.trim(),
              crm: medico.crm_medico.trim(),
              ufCrm: medico.uf_medico.trim().toUpperCase(),
              conselho: medico.conselho_medico?.trim() || 'CRM',
            },
            update: {
              nome: medico.nome_medico.trim(),
              conselho: medico.conselho_medico?.trim() || 'CRM',
            },
          });

          inseridos++;
          if (medico.cod_medico > maiorCodigo) {
            maiorCodigo = medico.cod_medico;
          }
        } catch (error) {
          this.logger.error(`Erro ao inserir médico ${medico.crm_medico}:`, error.message);
        }
      }

      // Atualizar controle de sincronização
      await this.prisma.sincronizacaoLegado.upsert({
        where: { tabela: 'medico' },
        create: {
          tabela: 'medico',
          ultimoCodigoSync: maiorCodigo,
          totalRegistros: inseridos,
          ultimaSincronizacao: new Date(),
        },
        update: {
          ultimoCodigoSync: maiorCodigo,
          totalRegistros: { increment: inseridos },
          ultimaSincronizacao: new Date(),
        },
      });

      this.logger.log(`✅ Sincronização de médicos concluída: ${inseridos} inseridos`);
    } catch (error) {
      this.logger.error('❌ Erro na sincronização de médicos:', error);
    } finally {
      this.sincronizandoMedicos = false;
    }
  }

  /**
   * Sincronização manual - pode ser chamada via endpoint
   */
  async sincronizarManual(tipo: 'exames' | 'medicos' | 'ambos') {
    const resultados = {
      exames: { sucesso: false, quantidade: 0, erro: null },
      medicos: { sucesso: false, quantidade: 0, erro: null },
    };

    if (tipo === 'exames' || tipo === 'ambos') {
      try {
        await this.sincronizarExames();
        const sync = await this.prisma.sincronizacaoLegado.findUnique({
          where: { tabela: 'tipo_ex' },
        });
        resultados.exames.sucesso = true;
        resultados.exames.quantidade = sync?.totalRegistros || 0;
      } catch (erro) {
        resultados.exames.erro = erro.message;
      }
    }

    if (tipo === 'medicos' || tipo === 'ambos') {
      try {
        await this.sincronizarMedicos();
        const sync = await this.prisma.sincronizacaoLegado.findUnique({
          where: { tabela: 'medico' },
        });
        resultados.medicos.sucesso = true;
        resultados.medicos.quantidade = sync?.totalRegistros || 0;
      } catch (erro) {
        resultados.medicos.erro = erro.message;
      }
    }

    return resultados;
  }

  /**
   * Busca novos exames no SQL Server
   */
  private async buscarNovosExamesSqlServer(ultimoCodigo: number): Promise<any[]> {
    const pool = await this.sqlServerService['getPool']();

    const query = `
      SELECT 
        cod_exame,
        descr_exame
      FROM tipo_ex
      WHERE cod_exame > @ultimoCodigo
      ORDER BY cod_exame ASC
    `;

    const sql = require('mssql');
    const result = await pool
      .request()
      .input('ultimoCodigo', sql.Int, ultimoCodigo)
      .query(query);

    return result.recordset || [];
  }

  /**
   * Busca novos médicos no SQL Server
   */
  private async buscarNovosMedicosSqlServer(ultimoCodigo: number): Promise<any[]> {
    const pool = await this.sqlServerService['getPool']();

    // IMPORTANTE: Assumindo que existe um campo cod_medico (chave primária)
    // Se não existir, você precisa ajustar a query
    const query = `
      SELECT TOP 1000
        ROW_NUMBER() OVER (ORDER BY crm_medico, uf_medico) as cod_medico,
        crm_medico,
        uf_medico,
        nome_medico,
        conselho_medico
      FROM medico
      WHERE NOT EXISTS (
        SELECT 1 FROM medico m2 
        WHERE m2.crm_medico = medico.crm_medico 
        AND m2.uf_medico = medico.uf_medico
        AND ROW_NUMBER() OVER (ORDER BY m2.crm_medico, m2.uf_medico) <= @ultimoCodigo
      )
      ORDER BY crm_medico, uf_medico
    `;

    const sql = require('mssql');
    const result = await pool
      .request()
      .input('ultimoCodigo', sql.Int, ultimoCodigo)
      .query(query);

    return result.recordset || [];
  }

  /**
   * Status da sincronização
   */
  async obterStatus() {
    const syncExames = await this.prisma.sincronizacaoLegado.findUnique({
      where: { tabela: 'tipo_ex' },
    });

    const syncMedicos = await this.prisma.sincronizacaoLegado.findUnique({
      where: { tabela: 'medico' },
    });

    const totalExames = await this.prisma.exame.count();
    const totalMedicos = await this.prisma.medico.count();

    return {
      exames: {
        totalSincronizados: totalExames,
        ultimoCodigoSync: syncExames?.ultimoCodigoSync || 0,
        ultimaSincronizacao: syncExames?.ultimaSincronizacao || null,
        sincronizando: this.sincronizandoExames,
      },
      medicos: {
        totalSincronizados: totalMedicos,
        ultimoCodigoSync: syncMedicos?.ultimoCodigoSync || 0,
        ultimaSincronizacao: syncMedicos?.ultimaSincronizacao || null,
        sincronizando: this.sincronizandoMedicos,
      },
    };
  }
}
