import { config } from '../config.js';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class SocketRateLimiter {
  private buckets = new Map<string, Bucket>();
  private maxTokens: number;
  private refillRatePerMs: number;

  constructor(maxTokensPerSec = 5000) {
    this.maxTokens = Math.max(maxTokensPerSec, 5000);
    this.refillRatePerMs = this.maxTokens / 1000;
  }

  public allow(socketId: string, tokensRequested = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(socketId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(socketId, bucket);
    } else {
      const elapsed = now - bucket.lastRefill;
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRatePerMs);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= tokensRequested) {
      bucket.tokens -= tokensRequested;
      return true;
    }

    return false;
  }

  public remove(socketId: string): void {
    this.buckets.delete(socketId);
  }
}

export const rateLimiter = new SocketRateLimiter();
