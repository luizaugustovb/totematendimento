import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

/**
 * Serviço para integração com SQL Server (sistema legado)
 * Realiza consultas na tabela de clientes
 */
@Injectable()
export class SqlServerService {
  private readonly logger = new Logger(SqlServerService.name);
  private pool: sql.ConnectionPool | null = null;
  private config: sql.config;

  constructor(private configService: ConfigService) {
    // Configuração de conexão SQL Server
    this.config = {
      user: this.configService.get<string>('SQL_SERVER_USER', 'sa'),
      password: this.configService.get<string>('SQL_SERVER_PASSWORD', ''),
      server: this.configService.get<string>('SQL_SERVER_HOST', 'localhost'),
      database: this.configService.get<string>('SQL_SERVER_DATABASE', 'LaboratorioDB'),
      port: this.configService.get<number>('SQL_SERVER_PORT', 1433),
      options: {
        encrypt: this.configService.get<boolean>('SQL_SERVER_ENCRYPT', false), // Para Azure: true
        trustServerCertificate: this.configService.get<boolean>('SQL_SERVER_TRUST_CERT', true),
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
  }

  /**
   * Obtém ou cria pool de conexão
   */
  private async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    try {
      this.logger.log('Conectando ao SQL Server...');
      this.pool = await new sql.ConnectionPool(this.config).connect();
      this.logger.log('Conexão SQL Server estabelecida com sucesso');
      
      // Event handlers
      this.pool.on('error', (err) => {
        this.logger.error('Erro no pool de conexão SQL Server', err);
      });

      return this.pool;
    } catch (error) {
      this.logger.error('Erro ao conectar ao SQL Server', error);
      throw error;
    }
  }

  /**
   * Testa a conexão com o banco de dados
   */
  async testarConexao(): Promise<boolean> {
    try {
      const pool = await this.getPool();
      const result = await pool.request().query('SELECT 1 AS test');
      this.logger.log('Teste de conexão SQL Server bem-sucedido');
      return result.recordset.length > 0;
    } catch (error) {
      this.logger.error('Teste de conexão SQL Server falhou', error);
      return false;
    }
  }

  /**
   * Consulta cliente por CPF
   */
  async consultarClientePorCPF(cpf: string): Promise<any | null> {
    try {
      const cpfLimpo = cpf.replace(/[^\d]/g, '');
      
      this.logger.log(`Consultando cliente por CPF: ${cpfLimpo}`);
      
      const pool = await this.getPool();
      
      // Query com estrutura real da tabela cliente
      const query = `
        SELECT 
          cod_cliente,
          nome_cliente,
          cpf_cliente,
          identidade_cliente,
          nascimento_cliente,
          sexo_cliente,
          fone_cliente,
          celular_cliente,
          email_cliente,
          endereco_cliente,
          endereco_numero_cliente,
          complemento_cliente,
          bairro_cliente,
          cidade_cliente,
          estado_cliente,
          cep_cliente,
          nome_mae,
          nome_pai,
          data_cadastro,
          tipo_sang,
          nome_social
        FROM cliente
        WHERE cpf_cliente = @cpf
          OR cpf_cliente = @cpfFormatado
      `;

      const result = await pool
        .request()
        .input('cpf', sql.VarChar(11), cpfLimpo)
        .input('cpfFormatado', sql.VarChar(14), this.formatarCPF(cpfLimpo))
        .query(query);

      if (result.recordset && result.recordset.length > 0) {
        const cliente = result.recordset[0];
        
        this.logger.log(`Cliente encontrado: ${cliente.nome_cliente}`);
        
        // Mapear para formato padronizado
        return {
          id: cliente.cod_cliente?.toString(),
          codigo_cliente: cliente.cod_cliente,
          nome: cliente.nome_cliente,
          nome_social: cliente.nome_social,
          cpf: cpfLimpo,
          rg: cliente.identidade_cliente,
          data_nascimento: cliente.nascimento_cliente 
            ? this.formatarData(cliente.nascimento_cliente) 
            : null,
          sexo: cliente.sexo_cliente,
          telefone: cliente.fone_cliente,
          celular: cliente.celular_cliente,
          email: cliente.email_cliente,
          endereco: this.montarEnderecoCompleto(cliente),
          bairro: cliente.bairro_cliente,
          cidade: cliente.cidade_cliente,
          estado: cliente.estado_cliente,
          cep: cliente.cep_cliente,
          nome_mae: cliente.nome_mae,
          nome_pai: cliente.nome_pai,
          tipo_sanguineo: cliente.tipo_sang,
          data_cadastro: cliente.data_cadastro,
        };
      }

      this.logger.log('Cliente não encontrado');
      return null;

    } catch (error) {
      this.logger.error('Erro ao consultar cliente por CPF', error);
      throw error;
    }
  }

  /**
   * Consulta cliente por RG
   */
  async consultarClientePorRG(rg: string): Promise<any | null> {
    try {
      const rgLimpo = rg.replace(/[^\d]/g, '');
      
      this.logger.log(`Consultando cliente por RG: ${rgLimpo}`);
      
      const pool = await this.getPool();
      
      const query = `
        SELECT 
          cod_cliente,
          nome_cliente,
          cpf_cliente,
          identidade_cliente,
          nascimento_cliente,
          sexo_cliente,
          fone_cliente,
          celular_cliente,
          email_cliente,
          endereco_cliente,
          endereco_numero_cliente,
          complemento_cliente,
          bairro_cliente,
          cidade_cliente,
          estado_cliente,
          cep_cliente,
          nome_mae,
          nome_pai,
          data_cadastro,
          tipo_sang,
          nome_social
        FROM cliente
        WHERE identidade_cliente = @rg
      `;

      const result = await pool
        .request()
        .input('rg', sql.VarChar(20), rgLimpo)
        .query(query);

      if (result.recordset && result.recordset.length > 0) {
        const cliente = result.recordset[0];
        
        this.logger.log(`Cliente encontrado: ${cliente.nome_cliente}`);
        
        return {
          id: cliente.cod_cliente?.toString(),
          codigo_cliente: cliente.cod_cliente,
          nome: cliente.nome_cliente,
          nome_social: cliente.nome_social,
          cpf: cliente.cpf_cliente?.replace(/[^\d]/g, ''),
          rg: rgLimpo,
          data_nascimento: cliente.nascimento_cliente 
            ? this.formatarData(cliente.nascimento_cliente) 
            : null,
          sexo: cliente.sexo_cliente,
          telefone: cliente.fone_cliente,
          celular: cliente.celular_cliente,
          email: cliente.email_cliente,
          endereco: this.montarEnderecoCompleto(cliente),
          bairro: cliente.bairro_cliente,
          cidade: cliente.cidade_cliente,
          estado: cliente.estado_cliente,
          cep: cliente.cep_cliente,
          nome_mae: cliente.nome_mae,
          nome_pai: cliente.nome_pai,
          tipo_sanguineo: cliente.tipo_sang,
          data_cadastro: cliente.data_cadastro,
        };
      }

      this.logger.log('Cliente não encontrado por RG');
      return null;

    } catch (error) {
      this.logger.error('Erro ao consultar cliente por RG', error);
      throw error;
    }
  }

  /**
   * Busca cliente por múltiplos critérios
   */
  async buscarCliente(cpf?: string, rg?: string, nome?: string): Promise<any | null> {
    // Prioridade: CPF > RG > Nome
    if (cpf) {
      return await this.consultarClientePorCPF(cpf);
    }
    
    if (rg) {
      return await this.consultarClientePorRG(rg);
    }

    // Busca por nome (menos preciso)
    if (nome && nome.length > 3) {
      return await this.consultarClientePorNome(nome);
    }

    return null;
  }

  /**
   * Consulta cliente por nome (busca aproximada)
   */
  async consultarClientePorNome(nome: string): Promise<any | null> {
    try {
      this.logger.log(`Consultando cliente por nome: ${nome}`);
      
      const pool = await this.getPool();
      
      const query = `
        SELECT TOP 1
          cod_cliente,
          nome_cliente,
          cpf_cliente,
          identidade_cliente,
          nascimento_cliente,
          sexo_cliente,
          fone_cliente,
          celular_cliente,
          email_cliente,
          endereco_cliente,
          endereco_numero_cliente,
          complemento_cliente,
          bairro_cliente,
          cidade_cliente,
          estado_cliente,
          cep_cliente,
          nome_mae,
          nome_pai,
          data_cadastro,
          tipo_sang,
          nome_social
        FROM cliente
        WHERE nome_cliente LIKE @nome
        ORDER BY data_cadastro DESC
      `;

      const result = await pool
        .request()
        .input('nome', sql.VarChar(255), `%${nome}%`)
        .query(query);

      if (result.recordset && result.recordset.length > 0) {
        const cliente = result.recordset[0];
        
        this.logger.log(`Cliente encontrado: ${cliente.nome_cliente}`);
        
        return {
          id: cliente.cod_cliente?.toString(),
          codigo_cliente: cliente.cod_cliente,
          nome: cliente.nome_cliente,
          nome_social: cliente.nome_social,
          cpf: cliente.cpf_cliente?.replace(/[^\d]/g, ''),
          rg: cliente.identidade_cliente,
          data_nascimento: cliente.nascimento_cliente 
            ? this.formatarData(cliente.nascimento_cliente) 
            : null,
          sexo: cliente.sexo_cliente,
          telefone: cliente.fone_cliente,
          celular: cliente.celular_cliente,
          email: cliente.email_cliente,
          endereco: this.montarEnderecoCompleto(cliente),
          bairro: cliente.bairro_cliente,
          cidade: cliente.cidade_cliente,
          estado: cliente.estado_cliente,
          cep: cliente.cep_cliente,
          nome_mae: cliente.nome_mae,
          nome_pai: cliente.nome_pai,
          tipo_sanguineo: cliente.tipo_sang,
          data_cadastro: cliente.data_cadastro,
        };
      }

      return null;

    } catch (error) {
      this.logger.error('Erro ao consultar cliente por nome', error);
      throw error;
    }
  }

  /**
   * Fecha pool de conexões
   */
  async fecharConexao(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
        this.logger.log('Pool de conexões SQL Server fechado');
      } catch (error) {
        this.logger.error('Erro ao fechar pool de conexões', error);
      }
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Formata CPF para padrão brasileiro
   */
  private formatarCPF(cpf: string): string {
    const cpfLimpo = cpf.replace(/[^\d]/g, '');
    if (cpfLimpo.length === 11) {
      return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  }

  /**
   * Formata data para padrão brasileiro
   */
  private formatarData(data: Date): string {
    const dataObj = typeof data === 'string' ? new Date(data) : data;
    
    const dia = String(dataObj.getDate()).padStart(2, '0');
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const ano = dataObj.getFullYear();
    
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Monta endereço completo a partir dos campos
   */
  private montarEnderecoCompleto(cliente: any): string {
    const partes = [];
    
    if (cliente.endereco_cliente) partes.push(cliente.endereco_cliente);
    if (cliente.endereco_numero_cliente) partes.push(`nº ${cliente.endereco_numero_cliente}`);
    if (cliente.complemento_cliente) partes.push(cliente.complemento_cliente);
    
    return partes.join(', ');
  }
}
