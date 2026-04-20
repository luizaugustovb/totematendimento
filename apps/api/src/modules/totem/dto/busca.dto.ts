import { IsString, IsOptional, IsInt, Min, Max, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// ===== BUSCA EXAMES =====

export class BuscarExamesDto {
  @IsString()
  textoOcr: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class SugerirExamesDto {
  @IsString()
  textoOcr: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

// ===== BUSCA MÉDICOS =====

export class BuscarMedicosDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  crm?: string;

  @IsOptional()
  @IsString()
  uf?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

// ===== SINÔNIMOS =====

export class AdicionarSinonimoDto {
  @IsUUID()
  exameId: string;

  @IsString()
  descricaoVariacao: string;

  @IsUUID()
  criadoPorUsuarioId: string;

  @IsOptional()
  @IsUUID()
  medicoId?: string;

  @IsOptional()
  @IsUUID()
  convenioId?: string;
}

export class RemoverSinonimoDto {
  @IsUUID()
  sinonimoId: string;
}

// ===== SINCRONIZAÇÃO =====

export class SincronizarManualDto {
  @IsEnum(['exames', 'medicos', 'ambos'])
  tipo: 'exames' | 'medicos' | 'ambos';
}

// ===== RESPONSES =====

export interface ExameEncontradoDto {
  exame: {
    id: string;
    nomePadrao: string;
    codigoInterno?: string;
    codigoTuss?: string;
  };
  score: number;
  matchTipo: 'EXATO' | 'CONTEM' | 'FUZZY';
  matchOrigem: 'NOME_PADRAO' | 'SINONIMO';
  sinonimo?: string;
}

export interface MedicoEncontradoDto {
  medico: {
    id: string;
    nome: string;
    crm: string;
    ufCrm: string;
    conselho?: string;
  };
  score: number;
}

export interface StatusSyncDto {
  exames: {
    totalSincronizados: number;
    ultimoCodigoSync: number;
    ultimaSincronizacao: Date | null;
    sincronizando: boolean;
  };
  medicos: {
    totalSincronizados: number;
    ultimoCodigoSync: number;
    ultimaSincronizacao: Date | null;
    sincronizando: boolean;
  };
}

// ==============================================
// LOGS DE AUDITORIA
// ==============================================

export class RegistrarLogDto {
  @IsString()
  acao: string;

  @IsOptional()
  @IsString()
  entidade?: string;

  @IsOptional()
  @IsString()
  detalhes?: string;

  @IsOptional()
  @IsString()
  usuario?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class BuscarLogsDto {
  @IsOptional()
  @IsString()
  acao?: string;

  @IsOptional()
  @IsString()
  entidade?: string;

  @IsOptional()
  @IsString()
  usuario?: string;

  @IsOptional()
  @IsString()
  dataInicio?: string; // ISO Date string

  @IsOptional()
  @IsString()
  dataFim?: string; // ISO Date string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

