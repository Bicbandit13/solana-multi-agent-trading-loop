/**
 * src/agents/grok-narrative.ts
 * Agent: Grok Social Narrative Scout
 *
 * Input:  Token address
 * Logic:  Queries Grok (xAI) for real-time social sentiment on X/Twitter.
 * Output: GrokNarrativeResult { sentimentScore, narrativeMomentum, summary }
 */
import OpenAI from 'openai';
import { config } from '../config/env';
import { sleep } from '../utils/gmgn';

export type NarrativeMomentum = 'Rising' | 'Stable' | 'Fading' | 'Unknown';

export interface GrokNarrativeResult {
  tokenAddress: string;
  sentimentScore: number;        // 1-10
  narrativeMomentum: NarrativeMomentum;
  trendingHashtags: string[];
  influencerMention: boolean;
  summary: string;
  timestamp: number;
}

const grokClient = new OpenAI({
  apiKey: config.grokApiKey,
  baseURL: config.grokApiBaseUrl,
});

function buildNarrativePrompt(tokenAddress: string): string {
  return `You are a crypto social intelligence agent with real-time X data.
Analyse social narrative for Solana token: ${tokenAddress}

1. Current sentiment (Bullish/Bearish/Neutral)?
2. Trending hashtags/cashtags?
3. Influencer mentions (>10k followers)?
4. Narrative momentum: Rising / Stable / Fading / Unknown
5. SentimentScore 1-10

Valid JSON only:
{
  "sentimentScore": <1-10>,
  "narrativeMomentum": "Rising" | "Stable" | "Fading" | "Unknown",
  "trendingHashtags": ["#tag"],
  "influencerMention": <boolean>,
  "summary": "<2 sentences>"
}`;
}

async function callGrokAPI(prompt: string, attempt = 1): Promise<string> {
  const MAX_RETRIES = 3;
  try {
    const completion = await grokClient.chat.completions.create({
      model: config.grokModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    return completion.choices[0]?.message?.content ?? '{}';
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429 && attempt < MAX_RETRIES) {
      console.warn(`[Grok] Rate limit. Retry ${attempt}/${MAX_RETRIES}`);
      await sleep(config.rateLimitRetryMs);
      return callGrokAPI(prompt, attempt + 1);
    }
    throw err;
  }
}

export async function runGrokNarrativeScan(
  tokenAddress: string,
): Promise<GrokNarrativeResult> {
  console.log(`[Grok] Narrative Scan -> ${tokenAddress}`);
  const raw = await callGrokAPI(buildNarrativePrompt(tokenAddress));

  let parsed: Partial<GrokNarrativeResult>;
  try {
    parsed = JSON.parse(raw) as Partial<GrokNarrativeResult>;
  } catch {
    throw new Error(`[Grok] Bad JSON: ${raw.slice(0, 150)}`);
  }

  return {
    tokenAddress,
    sentimentScore: Number(parsed.sentimentScore ?? 5),
    narrativeMomentum: parsed.narrativeMomentum ?? 'Unknown',
    trendingHashtags: Array.isArray(parsed.trendingHashtags) ? parsed.trendingHashtags : [],
    influencerMention: Boolean(parsed.influencerMention),
    summary: parsed.summary ?? '',
    timestamp: Date.now(),
  };
}
