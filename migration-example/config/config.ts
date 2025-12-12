/**
 * 配置管理
 * 從環境變數或 config.js 載入設定
 */

export interface Config {
  googleSheet: {
    spreadsheetId: string;
    credentialsPath?: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  firestore: {
    projectId: string;
  };
  cache: {
    defaultTtl: number; // 預設快取時間（秒）
    memoryCacheSize: number; // 記憶體快取大小（項目數）
  };
}

// 從環境變數載入配置
export const config: Config = {
  googleSheet: {
    spreadsheetId: process.env.GOOGLE_SHEET_ID || '',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  firestore: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
  },
  cache: {
    defaultTtl: parseInt(process.env.CACHE_TTL || '300', 10),
    memoryCacheSize: parseInt(process.env.MEMORY_CACHE_SIZE || '1000', 10),
  },
};

// 驗證必要配置
if (!config.googleSheet.spreadsheetId) {
  throw new Error('GOOGLE_SHEET_ID environment variable is required');
}

