import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
    algorithm: 'HS256',
  },

  // Password Configuration
  password: {
    saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS) || 12,
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
  },

  // Session Configuration
  session: {
    expiration: parseInt(process.env.SESSION_EXPIRATION) || 86400, // 24 hours
    extendedExpiration: parseInt(process.env.SESSION_EXTENDED_EXPIRATION) || 2592000, // 30 days
    maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER) || 5,
  },

  // Refresh Token Configuration
  refreshToken: {
    expiration: parseInt(process.env.REFRESH_TOKEN_EXPIRATION) || 604800, // 7 days
    extendedExpiration: parseInt(process.env.REFRESH_TOKEN_EXTENDED_EXPIRATION) || 2592000, // 30 days
    maxTokensPerUser: parseInt(process.env.MAX_REFRESH_TOKENS_PER_USER) || 10,
  },

  // Rate Limiting Configuration
  rateLimit: {
    login: {
      ttl: parseInt(process.env.LOGIN_RATE_LIMIT_TTL) || 300000, // 5 minutes
      limit: parseInt(process.env.LOGIN_RATE_LIMIT_ATTEMPTS) || 5,
    },
    register: {
      ttl: parseInt(process.env.REGISTER_RATE_LIMIT_TTL) || 3600000, // 1 hour
      limit: parseInt(process.env.REGISTER_RATE_LIMIT_ATTEMPTS) || 3,
    },
    passwordReset: {
      ttl: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_TTL) || 3600000, // 1 hour
      limit: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_ATTEMPTS) || 3,
    },
    emailVerification: {
      ttl: parseInt(process.env.EMAIL_VERIFICATION_RATE_LIMIT_TTL) || 1800000, // 30 minutes
      limit: parseInt(process.env.EMAIL_VERIFICATION_RATE_LIMIT_ATTEMPTS) || 3,
    },
  },

  // Security Configuration
  security: {
    enableRecaptcha: process.env.ENABLE_RECAPTCHA === 'true',
    enableTwoFactor: process.env.ENABLE_TWO_FACTOR === 'true',
    enableAccountLockout: process.env.ENABLE_ACCOUNT_LOCKOUT === 'true',
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION) || 900000, // 15 minutes
    enablePasswordHistory: process.env.ENABLE_PASSWORD_HISTORY === 'true',
    passwordHistorySize: parseInt(process.env.PASSWORD_HISTORY_SIZE) || 5,
  },

  // Email Configuration
  email: {
    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION !== 'false',
    verificationTokenExpiration: parseInt(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRATION) || 86400000, // 24 hours
    passwordResetTokenExpiration: parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRATION) || 3600000, // 1 hour
  },

  // Cookie Configuration
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 86400000, // 24 hours
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
}));