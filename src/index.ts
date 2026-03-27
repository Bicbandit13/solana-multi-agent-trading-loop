/**
 * src/index.ts
 * Solana Autonomous Multi-Agent Trading Loop
 *
 * Pipeline per token:
 *   A. Grok   -> Social Narrative Scan (soft pre-filter)
 *   B. Gemini -> Technical Vision Audit -> TechnicalScore 1-10
 *   C. if score > GEMINI_SCORE_THRESHOLD -> escalate to DeepSeek
 *   D. DeepSeek -> Quant Final Filter -> FinalConvictionScore + executeTrade
 *   E. if executeTrade -> Jupiter swap
 */
import { config } from './config/env';
import { getTrendingTokens, getOnChainMetrics, sleep } from './utils/gmgn';
import { executeJupiterSwap } from './utils/solana';
import { runGrokNarrativeScan } from './agents/grok-narrative';
import { runGeminiAudit, type TokenChartMetadata } from './agents/gemini-chart';
import { runDeepSeekQuantFilter } from './agents/deepseek-quant';

async function coordinateAgents(tokenAddress: string): Promise<boolean> {
  console.log(`\n[${'='.repeat(58)}]`);
  console.log(`[Loop] Coordinating agents for: ${tokenAddress}`);

  // Step 0: Fetch on-chain data
  const onChain = await getOnChainMetrics(tokenAddress);
  console.log(`[Loop] Liq=$${onChain.liquidityUsd} Dev=${onChain.devHoldingPct}% Top10=${onChain.top10HolderPct}%`);

  // Hard pre-filter before hitting AI APIs
  if (onChain.devHoldingPct > 20 || onChain.top10HolderPct > 60 || onChain.liquidityUsd < 50000) {
    console.log('[Loop] Hard pre-filter FAILED. Skipping.');
    return false;
  }

  // Step A: Grok Narrative Scan (non-blocking)
  try {
    const grok = await runGrokNarrativeScan(tokenAddress);
    console.log(`[Grok]  Sentiment=${grok.sentimentScore}/10 Momentum=${grok.narrativeMomentum}`);
    if (grok.narrativeMomentum === 'Fading' && grok.sentimentScore < 4) {
      console.log('[Loop] Grok: fading narrative. Skip.');
      return false;
    }
  } catch (e) {
    console.warn('[Loop] Grok unavailable (non-blocking):', (e as Error).message);
  }

  // Step B: Gemini Technical Vision Audit
  const meta: TokenChartMetadata = {
    tokenAddress,
    priceUsd: onChain.priceUsd,
    volume24hUsd: onChain.volume24hUsd,
    liquidityUsd: onChain.liquidityUsd,
    marketCapUsd: onChain.marketCapUsd,
    priceChange1h: 0,
    priceChange24h: 0,
    txCount5m: onChain.txCount5m,
  };

  const gemini = await runGeminiAudit(meta);
  console.log(`[Gemini] Score=${gemini.technicalScore}/10 Trend=${gemini.trendSentiment}`);
  console.log(`[Gemini] ${gemini.reasoning}`);

  // Step C: Gemini gate
  if (gemini.technicalScore <= config.geminiScoreThreshold) {
    console.log(`[Loop] Gemini ${gemini.technicalScore} <= ${config.geminiScoreThreshold}. Skip DeepSeek.`);
    return false;
  }
  console.log('[Loop] Gemini PASSED. Escalating to DeepSeek...');

  // Step D: DeepSeek Quant Final Filter
  const ds = await runDeepSeekQuantFilter(gemini, onChain);
  console.log(`[DeepSeek] Conviction=${ds.finalConvictionScore}/10 Execute=${ds.executeTrade}`);
  console.log(`[DeepSeek] ${ds.reasoning}`);
  if (ds.riskFlags.length) console.log(`[DeepSeek] Flags: ${ds.riskFlags.join(', ')}`);

  if (!ds.executeTrade) {
    console.log('[Loop] DeepSeek REJECTED trade.');
    return false;
  }

  // Step E: Execute Jupiter Swap
  console.log(`[Loop] TRADE APPROVED - executing Jupiter swap...`);
  try {
    const swap = await executeJupiterSwap(tokenAddress, config.tradeAmountLamports);
    console.log(`[Loop] SWAP COMPLETE | Tx: ${swap.txSignature}`);
    console.log(`[Loop] Solscan: https://solscan.io/tx/${swap.txSignature}`);
    return true;
  } catch (e) {
    console.error('[Loop] Swap FAILED:', (e as Error).message);
    return false;
  }
}

async function main(): Promise<void> {
  console.log('\n====================================');
  console.log(' Solana Multi-Agent Trading Loop');
  console.log(`  Gemini gate   : >${config.geminiScoreThreshold}`);
  console.log(`  DeepSeek gate : >${config.deepseekConvictionThreshold}`);
  console.log(`  Trade size    : ${config.tradeAmountLamports} lamports`);
  console.log(`  Poll interval : ${config.pollIntervalMs}ms`);
  console.log('====================================\n');

  let iteration = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    iteration += 1;
    console.log(`\n[Main] ===== Iteration #${iteration} @ ${new Date().toISOString()} =====`);

    try {
      const tokens = await getTrendingTokens();
      console.log(`[Main] ${tokens.length} trending tokens discovered`);

      let executed = 0;
      for (const addr of tokens) {
        try {
          const traded = await coordinateAgents(addr);
          if (traded) executed += 1;
        } catch (e) {
          console.error(`[Main] Token ${addr} error:`, (e as Error).message);
        }
        await sleep(2000); // rate-limit buffer between tokens
      }
      console.log(`[Main] Iteration #${iteration} done. Trades: ${executed}`);
    } catch (e) {
      console.error('[Main] Iteration error:', (e as Error).message);
    }

    console.log(`[Main] Sleeping ${config.pollIntervalMs}ms...`);
    await sleep(config.pollIntervalMs);
  }
}

process.on('SIGINT', () => { console.log('\nShutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\nShutting down...'); process.exit(0); });
process.on('unhandledRejection', (r) => console.error('[Main] Unhandled:', r));

main().catch((e) => { console.error('[Main] Fatal:', e); process.exit(1); });
