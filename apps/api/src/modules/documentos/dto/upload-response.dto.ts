import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ description: 'ID do documento criado' })
  id: string;

  @ApiProperty({ description: 'Nome original do arquivo' })
  nomeOriginal: string;

  @ApiProperty({ description: 'Nome do arquivo no servidor' })
  nomeArquivo: string;

  @ApiProperty({ description: 'Tipo MIME do arquivo' })
  tipoMime: string;

  @ApiProperty({ description: 'Tamanho do arquivo em bytes' })
  tamanho: number;

  @ApiProperty({ description: 'Status do processamento' })
  status: string;

  @ApiProperty({ description: 'URL de download' })
  urlDownload?: string;

  @ApiProperty({ description: 'URL do thumbnail (se disponível)' })
  urlThumbnail?: string;

  @ApiProperty({ description: 'Hash do arquivo para verificação' })
  hash: string;

  @ApiProperty({ description: 'Data de criação' })
  criadoEm: Date;

  constructor(partial: Partial<UploadResponseDto>) {
    Object.assign(this, partial);
  }
}

export class MultiUploadResponseDto {
  @ApiProperty({ type: [UploadResponseDto] })
  sucessos: UploadResponseDto[];

  @ApiProperty({ description: 'Arquivos que falharam no upload' })
  falhas: Array<{
    nomeOriginal: string;
    erro: string;
  }>;

  @ApiProperty({ description: 'Total de arquivos processados' })
  total: number;

  @ApiProperty({ description: 'Arquivos enviados com sucesso' })
  sucessoCount: number;

  @ApiProperty({ description: 'Arquivos que falharam' })
  falhaCount: number;
}