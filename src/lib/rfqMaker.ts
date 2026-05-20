// Browser-side RFQ maker pool.
//
// In production, multiple Circle-onboarded institutions (Wintermute, Jump,
// Citadel, etc.) would each run their own quote server with HSM-protected
// keys. For the hackathon demo we run **N synthetic makers** in the browser,
// each with its own deterministic key derived from a shared seed, so a single
// swap UI can showcase competing quotes from multiple counterparties.
//
// All maker addresses are registered on-chain via `ObscuraRFQ.setMaker(...)`
// during deployment / a follow-up admin call.
//
// Two modes:
//   1. **Browser pool** (default if `VITE_RFQ_MAKER_PRIVATE_KEY` is set):
//      derive 3 makers from the seed and have all of them quote on every
//      request. The smart router picks the best.
//   2. **Remote API** (default if `VITE_RFQ_API_URL` is set):
//      POST `{ tokenIn, tokenOut, amountIn, taker }` to the URL and expect
//      an array of signed quotes back. The frontend stays identical.

import {
  encodePacked,
  hexToBigInt,
  keccak256,
  parseUnits,
  formatUnits,
  type Hex,
} from 'viem';
import { privateKeyToAccount, type LocalAccount } from 'viem/accounts';
import {
  RFQ_EIP712_DOMAIN,
  RFQ_EIP712_TYPES,
  RFQ_DEFAULT_IMPROVEMENT_BPS,
} from '../config/rfqConfig';
import {
  OBSCURA_RFQ_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  RFQ_MAKER_ADDRESS,
} from '../config/arc';

export interface SignedQuote {
  quoteId: Hex;
  maker: `0x${string}`;
  taker: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
  expiry: bigint;
  signature: Hex;
  source: 'browser' | 'remote';
  /** Marker label for the UI ("Wintermute / Jump / Citadel / etc."). */
  makerLabel: string;
  /** Improvement vs the on-chain Pyth fair price, in bps. */
  improvementBps: number;
}

const MAKER_KEY: Hex | undefined = undefined; // Moved to server-side /api/sign-quote
const REMOTE_URL: string | undefined =
  (import.meta as any).env?.VITE_RFQ_API_URL || '/api/sign-quote';

// Synthetic maker pool. Each maker has a fixed personality (label + spread).
// Keys are derived from `MAKER_KEY` so the deployer only needs to register
// the deterministically-derived addresses on-chain via setMaker().
//
// We intentionally derive by xor-ing a salt into the high bytes of the key
// so the resulting accounts are unrelated to each other but reproducible
// across browser sessions.
interface MakerProfile {
  label: string;
  /** Tightening (negative = better for taker) on top of fair price, bps. */
  improvementBps: number;
  /** Random jitter range so quotes don't all look identical, bps. */
  jitterBps: number;
  /** Probability this maker actually returns a quote (0..1). */
  fillRate: number;
  /** Address (filled at runtime). */
  address?: `0x${string}`;
  /** Account (filled at runtime). */
  account?: LocalAccount;
}

const MAKER_POOL: MakerProfile[] = [
  { label: 'Wintermute',  improvementBps: 12, jitterBps: 4, fillRate: 0.95 },
  { label: 'Jump Trading', improvementBps:  8, jitterBps: 5, fillRate: 0.92 },
  { label: 'Citadel Sec.', improvementBps:  6, jitterBps: 6, fillRate: 0.88 },
];

/** Derive a key by xor-ing a salt into the seed. */
function deriveKey(seed: Hex, salt: number): Hex {
  // Strip 0x prefix.
  const hex = seed.slice(2).toLowerCase();
  if (hex.length !== 64) return seed;
  // XOR a 16-bit value into bytes 0-1 of the seed. Result is reproducible
  // and deterministic given the same seed.
  const high = parseInt(hex.slice(0, 4), 16) ^ (salt & 0xffff);
  const tail = hex.slice(4);
  return ('0x' + high.toString(16).padStart(4, '0') + tail) as Hex;
}

let initialized = false;
function initializeMakers(): MakerProfile[] {
  if (initialized) return MAKER_POOL;
  if (!MAKER_KEY) return [];

  try {
    // First maker uses the seed key directly (matches `RFQ_MAKER_ADDRESS`
    // registered by the deploy script). The other two are derivatives.
    MAKER_POOL[0].account = privateKeyToAccount(MAKER_KEY);
    MAKER_POOL[0].address = MAKER_POOL[0].account.address as `0x${string}`;

    for (let i = 1; i < MAKER_POOL.length; i++) {
      const k = deriveKey(MAKER_KEY, 0xa11c + i * 0x100);
      const acc = privateKeyToAccount(k);
      MAKER_POOL[i].account = acc;
      MAKER_POOL[i].address = acc.address as `0x${string}`;
    }
  } catch (e) {
    console.warn('[rfq] failed to derive maker pool:', e);
    return [];
  }

  initialized = true;
  return MAKER_POOL;
}

export function getMakerPool(): { label: string; address: string }[] {
  return initializeMakers().map((m) => ({
    label: m.label,
    address: m.address ?? '',
  }));
}

export function isRfqAvailable(): boolean {
  return Boolean(MAKER_KEY || REMOTE_URL);
}

/**
 * Request signed quotes from every available maker. Returns the FULL set
 * (sorted best-to-worst) so the smart router can pick whichever beats the
 * AMM. Multi-maker output is exposed verbatim in the UI's quote panel so
 * judges can see the competing quotes flow.
 */
export async function requestQuotes(params: {
  taker: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  fairAmountOut: bigint;
  expirySeconds?: number;
}): Promise<SignedQuote[]> {
  if (REMOTE_URL) {
    return requestRemoteQuotes(params);
  }
  return requestLocalQuotes(params);
}

/** Convenience: request quotes and return only the best one. */
export async function requestQuote(
  params: Parameters<typeof requestQuotes>[0]
): Promise<SignedQuote | null> {
  const all = await requestQuotes(params);
  return all[0] ?? null;
}

async function requestLocalQuotes({
  taker,
  tokenIn,
  tokenOut,
  amountIn,
  fairAmountOut,
  expirySeconds = 30,
}: Parameters<typeof requestQuotes>[0]): Promise<SignedQuote[]> {
  const pool = initializeMakers();
  if (pool.length === 0) return [];

  const expiry = BigInt(Math.floor(Date.now() / 1000) + expirySeconds);

  const promises = pool.map(async (maker, i): Promise<SignedQuote | null> => {
    if (!maker.account || !maker.address) return null;
    // Simulate fill rate: occasionally a maker declines.
    if (Math.random() > maker.fillRate) return null;

    // Compute this maker's quote: fair * (1 + improvement + jitter).
    // jitter is uniform in [-jitterBps/2, +jitterBps/2]
    const jitter = Math.floor((Math.random() - 0.5) * maker.jitterBps);
    const totalBps = maker.improvementBps + jitter;
    const amountOut = (fairAmountOut * BigInt(10_000 + totalBps)) / 10_000n;

    const quoteId = generateQuoteId(maker.address, taker, amountIn, i);

    const message = {
      quoteId,
      maker: maker.address,
      taker,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      expiry,
    };

    try {
      const signature = await maker.account.signTypedData({
        domain: rfqDomain(),
        types: RFQ_EIP712_TYPES,
        primaryType: 'Quote',
        message,
      });

      return {
        ...message,
        signature,
        source: 'browser' as const,
        makerLabel: maker.label,
        improvementBps: totalBps,
      };
    } catch (e) {
      console.warn(`[rfq] ${maker.label} failed to sign:`, e);
      return null;
    }
  });

  const settled = await Promise.all(promises);
  const valid = settled.filter((q): q is SignedQuote => q !== null);
  // Sort by amountOut DESC = best first.
  valid.sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0));
  return valid;
}

async function requestRemoteQuotes(
  params: Parameters<typeof requestQuotes>[0]
): Promise<SignedQuote[]> {
  if (!REMOTE_URL) return [];
  try {
    const res = await fetch(REMOTE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taker: params.taker,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn.toString(),
        fairAmountOut: params.fairAmountOut.toString(),
        expirySeconds: params.expirySeconds ?? 30,
        chainId: ARC_TESTNET_CHAIN_ID,
        verifyingContract: OBSCURA_RFQ_ADDRESS,
      }),
    });
    if (!res.ok) {
      console.warn('[rfq] remote quote rejected', res.status);
      return [];
    }
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : [data];
    return list.map((q) => ({
      ...q,
      amountIn: BigInt(q.amountIn),
      amountOut: BigInt(q.amountOut),
      expiry: BigInt(q.expiry),
      source: 'remote' as const,
      makerLabel: q.makerLabel ?? 'Maker',
      improvementBps: q.improvementBps ?? 0,
    }));
  } catch (e) {
    console.warn('[rfq] remote quote failed', e);
    return [];
  }
}

function rfqDomain() {
  return {
    name: RFQ_EIP712_DOMAIN.name,
    version: RFQ_EIP712_DOMAIN.version,
    chainId: ARC_TESTNET_CHAIN_ID,
    verifyingContract: OBSCURA_RFQ_ADDRESS,
  } as const;
}

function generateQuoteId(maker: string, taker: string, amountIn: bigint, idx: number): Hex {
  const salt =
    BigInt(Date.now()) * 1_000_000n +
    BigInt(Math.floor(Math.random() * 1_000_000)) +
    BigInt(idx);
  return keccak256(
    encodePacked(
      ['address', 'address', 'uint256', 'uint256'],
      [maker as `0x${string}`, taker as `0x${string}`, amountIn, salt]
    )
  );
}

// Tiny helpers exposed for the SwapTab UI.
export function formatQuoteSummary(
  q: SignedQuote,
  decimalsIn: number,
  decimalsOut: number
): string {
  const inFmt = parseFloat(formatUnits(q.amountIn, decimalsIn)).toFixed(4);
  const outFmt = parseFloat(formatUnits(q.amountOut, decimalsOut)).toFixed(6);
  return `${q.makerLabel}: ${inFmt} → ${outFmt}`;
}

export function quoteRemainingMs(q: SignedQuote): number {
  return Math.max(0, Number(q.expiry) * 1000 - Date.now());
}

export { parseUnits, formatUnits, hexToBigInt };
