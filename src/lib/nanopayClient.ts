// Browser-side Nanopay channel manager.
//
// The agent opens **one** channel per (payer, payee) pair and signs running
// totals off-chain as it consumes services. State lives in `localStorage` so
// the user doesn't reopen channels every time they refresh.
//
// This module is intentionally service-agnostic: it tracks accumulated spend
// per "service" key (e.g. `rfq:0xMaker…`, `llm:jatevo`, `pyth:hermes`) and
// produces signed `ChannelClaim` payloads ready to submit on-chain.

import { keccak256, encodePacked, type Hex } from 'viem';
import { privateKeyToAccount, type LocalAccount } from 'viem/accounts';
import {
  NANOPAY_EIP712_DOMAIN,
  NANOPAY_EIP712_TYPES,
  NANOPAY_RATES,
} from '../config/nanopayConfig';
import {
  OBSCURA_NANOPAY_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
} from '../config/arc';

const STORAGE_PREFIX = 'obscura:nanopay:';

interface ChannelState {
  /** keccak256(payer, payee, salt) — also the on-chain channelId */
  channelId: Hex;
  payer: `0x${string}`;
  payee: `0x${string}`;
  salt: Hex;
  /** raw USDC, 6 decimals */
  totalSpent: bigint;
  nonce: bigint;
  /** When the channel was opened (timestamp ms) */
  openedAt: number;
  /** Per-service tally: serviceKey -> raw USDC spent */
  byService: Record<string, string>;
  /** Latest payee-claimable signature (so a refresh doesn't lose it). */
  latestSignature?: Hex;
}

interface SignedSettlement {
  channelId: Hex;
  totalSpent: bigint;
  nonce: bigint;
  signature: Hex;
}

const SESSION_KEY_VAR = 'OBSCURA_NANOPAY_SESSION_KEY';

let cachedAccount: LocalAccount | null = null;

/**
 * The "session key" we use to sign nanopay claims. For the demo, we generate
 * a random ephemeral key per browser session (stored in sessionStorage).
 * In production this would be a passkey-protected session key from Circle.
 */
function getSessionAccount(): LocalAccount | null {
  if (cachedAccount) return cachedAccount;
  try {
    let key = sessionStorage.getItem(SESSION_KEY_VAR);
    if (!key) {
      // Generate a random ephemeral key for demo nanopay signing
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      key = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(SESSION_KEY_VAR, key);
    }
    cachedAccount = privateKeyToAccount(key as Hex);
    return cachedAccount;
  } catch {
    return null;
  }
}

function loadState(channelId: Hex): ChannelState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + channelId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      totalSpent: BigInt(parsed.totalSpent ?? '0'),
      nonce: BigInt(parsed.nonce ?? '0'),
    };
  } catch {
    return null;
  }
}

function saveState(state: ChannelState) {
  if (typeof localStorage === 'undefined') return;
  const serial = {
    ...state,
    totalSpent: state.totalSpent.toString(),
    nonce: state.nonce.toString(),
  };
  localStorage.setItem(STORAGE_PREFIX + state.channelId, JSON.stringify(serial));
}

/** Compute the deterministic channelId for a given (payer, payee, salt). */
export function computeChannelId(
  payer: `0x${string}`,
  payee: `0x${string}`,
  salt: Hex
): Hex {
  return keccak256(encodePacked(['address', 'address', 'bytes32'], [payer, payee, salt]));
}

export function isNanopayConfigured(): boolean {
  return (
    OBSCURA_NANOPAY_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
    !!getSessionAccount()
  );
}

/**
 * Open (or recover) a channel between `payer` and `payee` with a deterministic
 * salt derived from the payer/payee addresses so refreshing the page reuses
 * the same channel rather than spawning new ones.
 */
export function deriveChannelId(
  payer: `0x${string}`,
  payee: `0x${string}`
): { channelId: Hex; salt: Hex } {
  // Stable salt = keccak256("obscura:nanopay:v1" + payer + payee).
  const salt = keccak256(
    encodePacked(
      ['string', 'address', 'address'],
      ['obscura:nanopay:v1', payer, payee]
    )
  );
  return { channelId: computeChannelId(payer, payee, salt), salt };
}

/**
 * Record a chargeable service event and return a freshly-signed settlement
 * payload the payee can submit on-chain. Returns null when nanopay isn't
 * configured (e.g. session key missing); callers should fall back to "free".
 */
export async function chargeService(
  payer: `0x${string}`,
  payee: `0x${string}`,
  serviceKey: string,
  amount: bigint
): Promise<SignedSettlement | null> {
  if (!isNanopayConfigured()) return null;

  const account = getSessionAccount();
  if (!account) return null;
  if (account.address.toLowerCase() !== payer.toLowerCase()) {
    // Session key doesn't match the payer; refuse rather than sign with the
    // wrong key (would fail on-chain anyway).
    console.warn('[nanopay] session key mismatch; not signing');
    return null;
  }

  const { channelId, salt } = deriveChannelId(payer, payee);
  const state: ChannelState = loadState(channelId) || {
    channelId,
    payer,
    payee,
    salt,
    totalSpent: 0n,
    nonce: 0n,
    openedAt: Date.now(),
    byService: {},
  };

  state.totalSpent += amount;
  state.nonce += 1n;
  state.byService[serviceKey] = (
    BigInt(state.byService[serviceKey] ?? '0') + amount
  ).toString();

  const signature = await account.signTypedData({
    domain: nanopayDomain(),
    types: NANOPAY_EIP712_TYPES,
    primaryType: 'ChannelClaim',
    message: {
      channelId,
      payer,
      payee,
      totalSpent: state.totalSpent,
      nonce: state.nonce,
    },
  });

  state.latestSignature = signature;
  saveState(state);

  return {
    channelId,
    totalSpent: state.totalSpent,
    nonce: state.nonce,
    signature,
  };
}

/** Snapshot the running total for UI display (read-only). */
export function getChannelSnapshot(
  payer: `0x${string}`,
  payee: `0x${string}`
): {
  channelId: Hex;
  totalSpent: bigint;
  nonce: bigint;
  byService: Record<string, bigint>;
} | null {
  const { channelId } = deriveChannelId(payer, payee);
  const state = loadState(channelId);
  if (!state) {
    return { channelId, totalSpent: 0n, nonce: 0n, byService: {} };
  }
  const byService: Record<string, bigint> = {};
  for (const [k, v] of Object.entries(state.byService)) byService[k] = BigInt(v);
  return {
    channelId,
    totalSpent: state.totalSpent,
    nonce: state.nonce,
    byService,
  };
}

function nanopayDomain() {
  return {
    name: NANOPAY_EIP712_DOMAIN.name,
    version: NANOPAY_EIP712_DOMAIN.version,
    chainId: ARC_TESTNET_CHAIN_ID,
    verifyingContract: OBSCURA_NANOPAY_ADDRESS,
  } as const;
}

// Convenience wrappers for the standard service rates.
export async function chargeRfqQuote(payer: `0x${string}`, payee: `0x${string}`) {
  return chargeService(payer, payee, `rfq:${payee.toLowerCase()}`, NANOPAY_RATES.RFQ_QUOTE_RATE);
}
export async function chargeLlmParse(payer: `0x${string}`, payee: `0x${string}`) {
  return chargeService(payer, payee, 'llm:jatevo', NANOPAY_RATES.LLM_PARSE_RATE);
}
export async function chargePythPush(payer: `0x${string}`, payee: `0x${string}`) {
  return chargeService(payer, payee, 'pyth:hermes', NANOPAY_RATES.PYTH_PUSH_RATE);
}
