export const integrationConfig = {
  // Configurações de CORS expandidas
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      'http://localhost:5173',
      'http://localhost:8080',
      process.env.FRONTEND_URL || 'http://localhost:3001'
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200,
  },

  // Configurações de WebSocket
  websocket: {
    cors: {
      origin: '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  },

  // Configurações de Upload
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    processingPath: process.env.PROCESSING_PATH || './processing',
  },

  // Configurações de IA
  ia: {
    enabled: process.env.IA_ENABLED !== 'false',
    pythonPath: process.env.PYTHON_PATH || 'python',
    modelPath: process.env.MODEL_PATH || './models',
    maxProcessingTime: 5 * 60 * 1000, // 5 minutos
  },

  // Configurações de Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // máximo 1000 requests por janela por IP
    skipSuccessfulRequests: false,
  },

  // Configurações de JWT
  jwt: {
    accessTokenExpiry: process.env.JWT_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'laboratorio-api',
    audience: process.env.JWT_AUDIENCE || 'laboratorio-frontend',
  },

  // Configurações de APIs externas
  external: {
    // Legacy System Integration
    softlab: {
      baseUrl: process.env.SOFTLAB_API_URL,
      apiKey: process.env.SOFTLAB_API_KEY,
      timeout: 30000,
    },
    // OCR Service
    ocr: {
      enabled: process.env.OCR_ENABLED !== 'false',
      engine: process.env.OCR_ENGINE || 'tesseract',
      languages: ['por', 'eng'],
    },
  },

  // Configurações de logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    fileEnabled: process.env.LOG_FILE_ENABLED === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },

  // Health Check
  healthCheck: {
    timeout: 5000,
    checkDatabase: true,
    checkRedis: process.env.REDIS_URL ? true : false,
    checkFileSystem: true,
  }
};
