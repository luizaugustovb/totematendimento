export interface DocumentoResponse {
  id: string;
  nome: string;
  nomeOriginal: string;
  nomeArquivo: string;
  tipoMime: string;
  tamanho: number;
  tamanhoFormatado: string;
  tipo: string;
  status: string;
  descricao?: string;
  tags: string[];
  hash: string;
  temThumbnail: boolean;
  temTextoExtraido: boolean;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  urls: {
    download: string;
    thumbnail?: string;
    preview: string;
  };
  usuario?: {
    id: string;
    nome: string;
    email: string;
  };
}

export interface UploadOptions {
  generateThumbnail?: boolean;
  extractText?: boolean;
  processWithIA?: boolean;
  organizarAutomaticamente?: boolean;
}

export interface ProcessingResult {
  documentoId: string;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
  steps: ProcessingStep[];
  duration: number;
  error?: string;
}

export interface ProcessingStep {
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  result?: any;
  error?: string;
}

export interface StorageInfo {
  usado: number;
  limite: number;
  percentualUso: number;
  livre: number;
  formatado: {
    usado: string;
    limite: string;
    livre: string;
  };
}

export interface ShareLink {
  documentoId: string;
  token: string;
  shareUrl: string;
  expiresAt: Date;
  createdAt: Date;
  accessCount?: number;
}

export interface DocumentFilter {
  search?: string;
  tipo?: string;
  status?: string;
  dataInicio?: Date;
  dataFim?: Date;
  tags?: string[];
  tamanhoMin?: number;
  tamanhoMax?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    pagina: number;
    limite: number;
    total: number;
    paginas: number;
    temProxima: boolean;
    temAnterior: boolean;
  };
}