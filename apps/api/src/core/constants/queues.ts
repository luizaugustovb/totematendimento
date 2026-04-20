// Nomes das filas do sistema
export const IA_QUEUE = 'ia-processing';
export const DOCUMENT_QUEUE = 'document-processing';
export const REPORT_QUEUE = 'report-generation';
export const EMAIL_QUEUE = 'email-sending';

// Tipos de jobs para cada fila
export const IA_JOBS = {
  PROCESS_TEXT: 'process-text',
  NORMALIZE_EXAM: 'normalize-exam',
  INTERPRET_DOCUMENT: 'interpret-document',
  EXTRACT_DATA: 'extract-data',
  CLASSIFY_DOCUMENT: 'classify-document',
  VALIDATE_CONSISTENCY: 'validate-consistency',
  GENERATE_SUMMARY: 'generate-summary',
} as const;

export const DOCUMENT_JOBS = {
  UPLOAD_PROCESS: 'upload-process',
  CONVERT_PDF: 'convert-pdf',
  EXTRACT_TEXT: 'extract-text',
  GENERATE_THUMBNAIL: 'generate-thumbnail',
  VIRUS_SCAN: 'virus-scan',
  COMPRESS_FILE: 'compress-file',
} as const;

export const REPORT_JOBS = {
  GENERATE_PATIENT_REPORT: 'generate-patient-report',
  GENERATE_STATISTICS_REPORT: 'generate-statistics-report',
  GENERATE_USAGE_REPORT: 'generate-usage-report',
  GENERATE_ERROR_REPORT: 'generate-error-report',
  EXPORT_TO_PDF: 'export-to-pdf',
  EXPORT_TO_EXCEL: 'export-to-excel',
} as const;

export const EMAIL_JOBS = {
  SEND_WELCOME: 'send-welcome',
  SEND_NOTIFICATION: 'send-notification',
  SEND_REPORT: 'send-report',
  SEND_ALERT: 'send-alert',
  SEND_PASSWORD_RESET: 'send-password-reset',
  SEND_BULK: 'send-bulk',
} as const;

// Prioridades dos jobs
export const JOB_PRIORITIES = {
  CRITICAL: 10,
  HIGH: 7,
  MEDIUM: 5,
  LOW: 3,
  BULK: 1,
} as const;

// Configurações de timeout por tipo de job
export const JOB_TIMEOUTS = {
  IA_PROCESSING: 5 * 60 * 1000, // 5 minutos
  DOCUMENT_PROCESSING: 3 * 60 * 1000, // 3 minutos
  REPORT_GENERATION: 10 * 60 * 1000, // 10 minutos
  EMAIL_SENDING: 30 * 1000, // 30 segundos
} as const;