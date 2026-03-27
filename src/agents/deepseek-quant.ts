/**
 * src/agents/deepseek-quant.ts
 * Agent: DeepSeek Quantitative Final Filter
 *
 * Input:  GeminiAuditResult + OnChainMetrics
 * Logic:  Validates Gemini's technical optimism against on-chain safety.
 *         Calculates FinalConvictionScore and issues ExecuteTrade boolean.
 * Output: DeepSeekQuantResult
 */
import OpenAI from 'openai';
import { config } from '../config/env';
import { sleep } from '../utils/gmgn';
import { type GeminiAuditResult } from './gemini-chart';
import { type OnChainMetrics } from '../utils/gmgn';

export interface DeepSeekQuantResult {
  tokenAddress: string;
  finalConvictionScore: number;   // 1-10
  executeTrade: boolean;
  riskFlags: string[];
  reasoning: string;
  timestamp: number;
}

const deepseekClient = new OpenAI({
  apiKey: config.deepseekApiKey,
  baseURL: config.deepseekApiBaseUrl,
});

function buildQuantPrompt(gemini: GeminiAuditResult, onChain: OnChainMetrics): string {
  return `You are a quant risk analyst for Solana meme-coin trades.

=== Gemini Technical Audit ===
TechnicalScore: ${gemini.technicalScore}/10
Trend: ${gemini.trendSentiment}
Reasoning: ${gemini.reasoning}
Support: $${gemini.supportLevel} | Resistance: $${gemini.resistanceLevel}

=== On-Chain Risk Metrics ===
Liquidity:     $${onChain.liquidityUsd}
Dev Holding:   ${onChain.devHoldingPct}%
Top10 Holders: ${onChain.top10HolderPct}%
Market Cap:    $${onChain.marketCapUsd}
24h Volume:    $${onChain.volume24hUsd}

Hard Reject Rules:
- devHoldingPct > 20% = REJECT
- top10HolderPct > 60% = REJECT
- liquidityUsd < 50000 = REJECT

Score up: volume/liquidity > 0.5 (active market)
Score down: marketCap < 100000 (micro-cap risk)

Set executeTrade = true ONLY if finalConvictionScore > ${config.deepseekConvictionThreshold}.

Respond with valid JSON only:
{
  "finalConvictionScore": <1-10>,
  "executeTrade": <boolean>,
  "riskFlags": ["<flag>"],
  "reasoning": "<2 sentences max>"
}`;
}

async function callDeepSeekAPI(prompt: string, attempt = 1): Promise<string> {
  const MAX_RETRIES = 3;
  try {
    const completion = await deepseekClient.chat.completions.create({
      model: config.deepseekModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    return completion.choices[0]?.message?.content ?? '{}';
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429 && attempt < MAX_RETRIES) {
      console.warn(`[DeepSeek] Rate limit. Retry ${attempt}/${MAX_RETRIES}`);
      await sleep(config.rateLimitRetryMs);
      return callDeepSeekAPI(prompt, attempt + 1);
    }
    throw err;
  }
}

export async function runDeepSeekQuantFilter(
  gemini: GeminiAuditResult,
  onChain: OnChainMetrics,
): Promise<DeepSeekQuantResult> {
  console.log(`[DeepSeek] Quant Filter for ${onChain.tokenAddress} | Gemini score: ${gemini.technicalScore}`);

  const raw = await callDeepSeekAPI(buildQuantPrompt(gemini, onChain));

  let parsed: Partial<DeepSeekQuantResult>;
  try {
    parsed = JSON.parse(raw) as Partial<DeepSeekQuantResult>;
  } catch {
    throw new Error(`[DeepSeek] Bad JSON: ${raw.slice(0, 150)}`);
  }

  const score = Number(parsed.finalConvictionScore ?? 0);
  // Double-safety: confirm both the model's flag AND score threshold
  const execute = Boolean(parsed.executeTrade) && score > config.deepseekConvictionThreshold;

  return {
    tokenAddress: onChain.tokenAddress,
    finalConvictionScore: score,
    executeTrade: execute,
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
    reasoning: parsed.reasoning ?? '',
    timestamp: Date.now(),
  };
}
