/**
 * src/utils/solana.ts
 * Solana connection helpers and Jupiter swap execution.
 */
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import { config } from '../config/env';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(config.rpcUrl, 'confirmed');
  }
  return _connection;
}

let _wallet: Keypair | null = null;

export function getWallet(): Keypair {
  if (!_wallet) {
    // Decode base58 private key
    const decoded = Buffer.from(config.solanaPrivateKey, 'base64');
    _wallet = Keypair.fromSecretKey(decoded);
  }
  return _wallet;
}

export interface SwapResult {
  txSignature: string;
  inputMint: string;
  outputMint: string;
  inAmount: number;
  outAmount: number;
}

/**
 * Executes a Jupiter V6 swap: SOL -> target token.
 * @param outputMint     Token mint to buy
 * @param amountLamports SOL amount to spend (in lamports)
 */
export async function executeJupiterSwap(
  outputMint: string,
  amountLamports: number,
): Promise<SwapResult> {
  const wallet = getWallet();
  const connection = getConnection();

  // 1. Get quote
  const { data: quoteData } = await axios.get(
    `${config.jupiterApiBaseUrl}/quote`,
    {
      params: {
        inputMint: config.solMint,
        outputMint,
        amount: amountLamports,
        slippageBps: 300,
      },
    },
  );

  // 2. Get swap transaction
  const { data: swapData } = await axios.post(
    `${config.jupiterApiBaseUrl}/swap`,
    {
      quoteResponse: quoteData,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    },
  );

  // 3. Sign and broadcast
  const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(txBuffer);
  transaction.sign([wallet]);

  const txSignature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false, maxRetries: 3 },
  );
  await connection.confirmTransaction(txSignature, 'confirmed');

  return {
    txSignature,
    inputMint: config.solMint,
    outputMint,
    inAmount: amountLamports,
    outAmount: Number(quoteData.outAmount),
  };
}

export async function getTokenInfo(
  mintAddress: string,
): Promise<Record<string, unknown>> {
  const { data } = await axios.get(
    `https://public-api.solscan.io/token/meta?tokenAddress=${mintAddress}`,
  );
  return data as Record<string, unknown>;
}
