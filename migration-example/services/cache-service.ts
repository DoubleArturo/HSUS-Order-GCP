/**
 * 多層快取服務
 * L1: Memory Cache (Node.js 記憶體)
 * L2: Redis Cache
 */

import Redis from 'ioredis';
import { config } from '../config/config';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private memoryCache: Map<string, CacheEntry<any>>;
  private redis: Redis;
  private maxMemorySize: number;

  constructor() {
    this.memoryCache = new Map();
    this.maxMemorySize = config.cache.memoryCacheSize;
    
    // 初始化 Redis 連線
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => {
        // 重試策略：最多重試 3 次
        if (times > 3) {
          return null; // 停止重試
        }
        return Math.min(times * 50, 2000);
      },
    });

    // 定期清理過期的記憶體快取
    setInterval(() => this.cleanMemoryCache(), 60000); // 每分鐘清理一次
  }

  /**
   * 從快取讀取資料
   */
  async get<T>(key: string): Promise<T | null> {
    // L1: 檢查記憶體快取
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.data as T;
    }
    if (memEntry) {
      this.memoryCache.delete(key); // 移除過期項目
    }

    // L2: 檢查 Redis 快取
    try {
      const redisData = await this.redis.get(key);
      if (redisData) {
        const data = JSON.parse(redisData) as T;
        // 寫回記憶體快取
        this.setMemoryCache(key, data, 60); // 記憶體快取 1 分鐘
        return data;
      }
    } catch (error) {
      console.error('Redis cache error:', error);
      // Redis 錯誤不影響主流程，繼續執行
    }

    return null;
  }

  /**
   * 寫入快取
   */
  async set<T>(key: string, data: T, ttl: number = config.cache.defaultTtl): Promise<void> {
    // L1: 寫入記憶體快取
    this.setMemoryCache(key, data, Math.min(ttl, 300)); // 記憶體快取最多 5 分鐘

    // L2: 寫入 Redis
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Redis set error:', error);
      // Redis 錯誤不影響主流程
    }
  }

  /**
   * 刪除快取
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  /**
   * 批次刪除（支援 pattern）
   */
  async deletePattern(pattern: string): Promise<void> {
    // 清理記憶體快取
    for (const key of this.memoryCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // 清理 Redis 快取
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis delete pattern error:', error);
    }
  }

  /**
   * 設定記憶體快取
   */
  private setMemoryCache<T>(key: string, data: T, ttl: number): void {
    // 如果記憶體快取已滿，移除最舊的項目
    if (this.memoryCache.size >= this.maxMemorySize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  /**
   * 清理過期的記憶體快取
   */
  private cleanMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * 簡單的 pattern 匹配（支援 * 萬用字元）
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  /**
   * 關閉連線
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// 單例實例
export const cacheService = new CacheService();

