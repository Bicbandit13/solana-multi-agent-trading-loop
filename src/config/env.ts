/**
 * src/config/env.ts
 * Centralised environment variable loader.
 * All modules should import config from here - never from process.env directly.
 */
import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  rpcUrl: requireEnv('RPC_URL'),
  solanaPrivateKey: requireEnv('SOLANA_PRIVATE_KEY'),
  solMint: process.env.SOL_MINT ?? 'So11111111111111111111111111111111111111112',
  gmgnApiKey: requireEnv('GMGN_API_KEY'),
  gmgnApiBaseUrl: process.env.GMGN_API_BASE_URL ?? 'https://api.gmgn.ai/v1',
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
  deepseekApiKey: requireEnv('DEEPSEEK_API_KEY'),
  deepseekApiBaseUrl: process.env.DEEPSEEK_API_BASE_URL ?? 'https://api.deepseek.com/v1',
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  grokApiKey: requireEnv('GROK_API_KEY'),
  grokApiBaseUrl: process.env.GROK_API_BASE_URL ?? 'https://api.x.ai/v1',
  grokModel: process.env.GROK_MODEL ?? 'grok-2-latest',
  jupiterApiBaseUrl: process.env.JUPITER_API_BASE_URL ?? 'https://quote-api.jup.ag/v6',
  geminiScoreThreshold: Number(process.env.GEMINI_SCORE_THRESHOLD ?? 7),
  deepseekConvictionThreshold: Number(process.env.DEEPSEEK_CONVICTION_THRESHOLD ?? 8),
  tradeAmountLamports: Number(process.env.TRADE_AMOUNT_LAMPORTS ?? 10000000),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30000),
  rateLimitRetryMs: Number(process.env.RATE_LIMIT_RETRY_MS ?? 10000),
} as const;

export type Config = typeof config;
