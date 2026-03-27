/**
 * src/agents/gemini-chart.ts
 * Agent: Gemini Technical Vision Auditor
 *
 * Input:  TokenChartMetadata (price, volume, liquidity, market cap, etc.)
 * Logic:  Technical Vision Audit - trend, S/R levels, volume clusters
 * Output: GeminiAuditResult { technicalScore (1-10), trendSentiment }
 */
import axios, { AxiosError } from 'axios';
import { config } from '../config/env';
import { sleep } from '../utils/gmgn';

export type TrendSentiment = 'Bullish' | 'Bearish' | 'Neutral';

export interface TokenChartMetadata {
  tokenAddress: string;
  priceUsd: number;
  volume24hUsd: number;
  liquidityUsd: number;
  marketCapUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  txCount5m: number;
}

export interface GeminiAuditResult {
  tokenAddress: string;
  technicalScore: number;    // 1-10
  trendSentiment: TrendSentiment;
  reasoning: string;
  supportLevel: number;
  resistanceLevel: number;
  volumeClusterNote: string;
  timestamp: number;
}

function buildAuditPrompt(meta: TokenChartMetadata): string {
  return `You are an expert Solana meme-coin technical analyst.
Analyse the following live token data and perform a Technical Vision Audit.

Token: ${meta.tokenAddress}
Price: $${meta.priceUsd}
24h Volume: $${meta.volume24hUsd}
Liquidity: $${meta.liquidityUsd}
Market Cap: $${meta.marketCapUsd}
1h Change: ${meta.priceChange1h}%
24h Change: ${meta.priceChange24h}%
5m Tx Count: ${meta.txCount5m}

Respond ONLY with valid JSON:
{
  "technicalScore": <number 1-10>,
  "trendSentiment": "Bullish" | "Bearish" | "Neutral",
  "reasoning": "<one sentence>",
  "supportLevel": <number>,
  "resistanceLevel": <number>,
  "volumeClusterNote": "<one sentence>"
}`;
}

async function callGeminiAPI(prompt: string, attempt = 1): Promise<string> {
  const MAX_RETRIES = 3;
  const url = [
    'https://generativelanguage.googleapis.com/v1beta/models/',
    config.geminiModel,
    ':generateContent?key=',
    config.geminiApiKey,
  ].join('');

  try {
    const { data } = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 429 && attempt < MAX_RETRIES) {
      console.warn(`[Gemini] Rate limit. Retry ${attempt}/${MAX_RETRIES} in ${config.rateLimitRetryMs}ms`);
      await sleep(config.rateLimitRetryMs);
      return callGeminiAPI(prompt, attempt + 1);
    }
    throw err;
  }
}

export async function runGeminiAudit(
  meta: TokenChartMetadata,
): Promise<GeminiAuditResult> {
  console.log(`[Gemini] Technical Vision Audit -> ${meta.tokenAddress}`);
  const raw = await callGeminiAPI(buildAuditPrompt(meta));

  let parsed: Partial<GeminiAuditResult>;
  try {
    parsed = JSON.parse(raw) as Partial<GeminiAuditResult>;
  } catch {
    throw new Error(`[Gemini] Bad JSON: ${raw.slice(0, 150)}`);
  }

  return {
    tokenAddress: meta.tokenAddress,
    technicalScore: Number(parsed.technicalScore ?? 0),
    trendSentiment: parsed.trendSentiment ?? 'Neutral',
    reasoning: parsed.reasoning ?? '',
    supportLevel: Number(parsed.supportLevel ?? 0),
    resistanceLevel: Number(parsed.resistanceLevel ?? 0),
    volumeClusterNote: parsed.volumeClusterNote ?? '',
    timestamp: Date.now(),
  };
}
