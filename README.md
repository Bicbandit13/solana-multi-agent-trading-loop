# Solana Autonomous Multi-Agent Trading Loop

An autonomous Solana meme-coin discovery and trading system powered by a **pipeline of specialised AI agents** — Grok, Gemini, and DeepSeek — connected to **GMGN**, **Solscan**, and **Jupiter** for execution.

---

## Architecture Overview

```
GMGN Trending Feed
        |
        v
[Hard Pre-Filter]  (Liquidity, Dev%, Top10%)
        |
        v
[Agent A: Grok]  Social Narrative Scout
  - Real-time X/Twitter sentiment
  - NarrativeMomentum: Rising / Stable / Fading
  - SentimentScore 1-10
  - Soft filter: skip if Fading + score < 4
        |
        v
[Agent B: Gemini]  Technical Vision Auditor
  - Input: GMGN on-chain metadata
  - Analyses trend, S/R levels, volume clusters
  - Output: TechnicalScore (1-10) + TrendSentiment
  - GATE: Skip if TechnicalScore <= 7
        |
   Score > 7
        |
        v
[Agent C: DeepSeek]  Quantitative Final Filter
  - Input: Gemini TechnicalScore + Raw on-chain data
  - Validates: Dev holding %, Top 10 concentration, Liquidity
  - Calculates: FinalConvictionScore (1-10)
  - Output: ExecuteTrade boolean
  - GATE: Only trade if FinalConvictionScore > 8
        |
  executeTrade = true
        |
        v
[Jupiter V6 Swap]
  - SOL -> Target Token
  - Dynamic slippage (3%)
  - Priority fee: auto
  - Confirmed on-chain
        |
        v
  Solscan TX Logged
        |
        v
  Sleep(POLL_INTERVAL) -> Repeat
```

---

## Agent Roles

| Agent | File | Model | Primary Role |
|-------|------|-------|-------------|
| Grok | `src/agents/grok-narrative.ts` | grok-2-latest | Real-time social sentiment from X |
| Gemini | `src/agents/gemini-chart.ts` | gemini-1.5-pro | Technical Vision Audit (chart analysis) |
| DeepSeek | `src/agents/deepseek-quant.ts` | deepseek-chat | Quantitative on-chain risk filter |

---

## Decision Gate Logic

```
Step 0: GMGN on-chain pre-filter
  liquidity     >= $50,000   (else reject)
  devHolding    <= 20%       (else reject)
  top10Holders  <= 60%       (else reject)

Step A: Grok
  if momentum == Fading AND sentimentScore < 4 -> reject

Step B: Gemini
  if technicalScore <= GEMINI_SCORE_THRESHOLD (default 7) -> reject

Step C: DeepSeek
  if finalConvictionScore <= DEEPSEEK_CONVICTION_THRESHOLD (default 8) -> reject
  OR if any hard risk rule triggered -> reject

Step D: Jupiter Swap (only if all gates pass)
```

---

## Project Structure

```
solana-multi-agent-trading-loop/
ss.gitignore
ss.env.example
sspackage.json
sstsconfig.json
ssREADME.md
ss
ssssrc/
ssss  index.ts              # Main loop + coordinateAgents()
ssss  config/
ssss    env.ts              # Centralised env var loader
ssss  agents/
ssss    grok-narrative.ts   # Agent A: Social narrative scout
ssss    gemini-chart.ts     # Agent B: Technical vision auditor
ssss    deepseek-quant.ts   # Agent C: Quant final filter
ssss  utils/
ssss    gmgn.ts             # GMGN API helpers + sleep/rate-limit utils
ssss    solana.ts           # Connection, wallet, Jupiter swap executor
```

---

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/Bicbandit13/solana-multi-agent-trading-loop.git
cd solana-multi-agent-trading-loop
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your real API keys
```

Required keys:
- `SOLANA_PRIVATE_KEY` - Your Solana wallet (base58)
- `RPC_URL` - Solana RPC endpoint
- `GMGN_API_KEY` - GMGN.ai API key
- `GEMINI_API_KEY` - Google AI Studio key
- `DEEPSEEK_API_KEY` - DeepSeek platform key
- `GROK_API_KEY` - xAI console key

### 3. Build

```bash
npm run build
```

### 4. Run (Production)

```bash
npm start
```

### 5. Dev Mode

```bash
npm run dev
```

---

## Security Notes

- **NEVER** commit your `.env` file
- **NEVER** commit wallet keypair JSON files (covered by `.gitignore`)
- All sensitive values must live in `.env` only
- Rate limit handling is built into every agent (exponential backoff on 429)

---

## Extending the Pipeline

- Add price change data (1h, 24h) by integrating the DexScreener API into `src/utils/`
- Add a Claude agent for compliance/narrative safety checking before execution
- Plug in a portfolio tracker to avoid re-buying held positions
- Add Telegram/Discord notifications on trade execution

---

## Disclaimer

This is experimental software for educational purposes. Meme-coin trading carries extreme risk. Never trade with funds you cannot afford to lose. The authors are not responsible for financial losses.
