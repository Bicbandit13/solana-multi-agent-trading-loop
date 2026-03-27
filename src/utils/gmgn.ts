/**
 * src/utils/gmgn.ts
 * GMGN.ai API helpers for on-chain token data.
 */
import axios, { AxiosError } from 'axios';
import { config } from '../config/env';

const gmgnClient = axios.create({
  baseURL: config.gmgnApiBaseUrl,
  headers: { 'X-API-KEY': config.gmgnApiKey },
  timeout: 15000,
});

export interface OnChainMetrics {
  tokenAddress: string;
  liquidityUsd: number;
  devHoldingPct: number;
  top10HolderPct: number;
  marketCapUsd: number;
  priceUsd: number;
  volume24hUsd: number;
  txCount5m: number;
}

export async function getOnChainMetrics(
  tokenAddress: string,
): Promise<OnChainMetrics> {
  const { data } = await gmgnClient.get(`/token/${tokenAddress}/metrics`);
  return {
    tokenAddress,
    liquidityUsd: Number(data.liquidity_usd ?? 0),
    devHoldingPct: Number(data.dev_holding_pct ?? 100),
    top10HolderPct: Number(data.top10_holder_pct ?? 100),
    marketCapUsd: Number(data.market_cap_usd ?? 0),
    priceUsd: Number(data.price_usd ?? 0),
    volume24hUsd: Number(data.volume_24h_usd ?? 0),
    txCount5m: Number(data.tx_count_5m ?? 0),
  };
}

export async function getTrendingTokens(): Promise<string[]> {
  const { data } = await gmgnClient.get('/trending', {
    params: { chain: 'sol', limit: 20 },
  });
  return (data.tokens ?? []).map((t: { address: string }) => t.address);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === 429;
}
