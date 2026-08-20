import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  canvasWidth: parseInt(process.env.CANVAS_WIDTH || '64', 10),
  canvasHeight: parseInt(process.env.CANVAS_HEIGHT || '64', 10),
  maxHistorySize: parseInt(process.env.MAX_HISTORY_SIZE || '5000', 10),
  rateLimitMaxPixelsPerSec: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
};
