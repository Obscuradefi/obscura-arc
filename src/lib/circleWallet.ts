// Circle Modular Wallets adapter for Obscura.
//
// Why this exists:
//   For Track 4 ("Agentic Economy") we want to demonstrate **gasless USDC
//   transactions on Arc Testnet** so the agent can settle micro-actions
//   without the user clicking through a wallet popup for every $0.001.
//
//   Modular Wallets give us:
//     1. Passkey-based account creation (WebAuthn, no seed phrase)
//     2. Smart Contract Account (ERC-4337) on Arc Testnet
//     3. `paymaster: true` -> Circle Gas Station sponsors gas in USDC
//     4. Batch operations -> agent can pack [approve, swap, claim] into one
//        userOp
//
// Scope honesty:
//   - We use this for **on-chain submission** (swap, settle, shield).
//   - For **EIP-712 signing** of RFQ quotes and Nanopay claims we still use
//     a session-key EOA derived from `VITE_RFQ_MAKER_PRIVATE_KEY`. Modular
//     Wallets sign via ERC-1271 (smart-contract signatures) which would
//     require ObscuraRFQ + ObscuraNanopay to call `isValidSignature` instead
//     of `ecrecover`. Out of scope for the hackathon window; documented as
//     future work in ARCHITECTURE.md.
//
// Configuration (.env):
//   VITE_CIRCLE_CLIENT_KEY      Client key from console.circle.com
//   VITE_CIRCLE_CLIENT_URL      Client URL (e.g., https://modular-sdk.circle.com/v1/rpc/w3s/buidl)
//   VITE_CIRCLE_PASSKEY_NAME    Default username for the passkey (optional)
//
// If any are missing, `isCircleWalletConfigured()` returns false and the UI
// hides the Circle Wallet connect option, falling back to RainbowKit.

import {
    toPasskeyTransport,
    toModularTransport,
    toWebAuthnCredential,
    toCircleSmartAccount,
    encodeTransfer,
    WebAuthnMode,
    type P256Credential,
} from '@circle-fin/modular-wallets-core';
import {
    createPublicClient,
    encodeFunctionData,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { toWebAuthnAccount, createBundlerClient } from 'viem/account-abstraction';
import { arcTestnet } from '../wagmi';

// ---------- env ----------

const CLIENT_KEY = (import.meta as any).env?.VITE_CIRCLE_CLIENT_KEY as string | undefined;
const CLIENT_URL = (import.meta as any).env?.VITE_CIRCLE_CLIENT_URL as string | undefined;
const DEFAULT_USERNAME =
    (import.meta as any).env?.VITE_CIRCLE_PASSKEY_NAME || 'obscura-agent';

// Arc Testnet uses the `/arcTestnet` path segment per the Modular Wallets docs.
// https://developers.circle.com/wallets/modular/create-a-wallet-and-send-gasless-txn
// Arc Testnet uses fairly aggressive gas pricing: the bundler refuses any
// userOp with `maxPriorityFeePerGas` below 1 gwei (`precheck failed`). Viem's
// default auto-estimator on Arc reports 0.002 gwei which is well below the
// floor, so we override every userOp with a known-good baseline. The 50 gwei
// max fee gives plenty of headroom over the ~25 gwei base fee Arc surfaces.
const ARC_MIN_PRIORITY_FEE = 1_000_000_000n; // 1 gwei
const ARC_DEFAULT_MAX_FEE = 50_000_000_000n; // 50 gwei

const ARC_TESTNET_PATH = 'arcTestnet';

const STORAGE_CRED_KEY = 'obscura:circle:credential';
const STORAGE_USERNAME_KEY = 'obscura:circle:username';

/**
 * Pick a username for the passkey enrollment. Strategy:
 *   1. If the caller passed an explicit username, use that.
 *   2. Otherwise, return a per-device username already stored in
 *      localStorage so future logins reuse the same Circle-side identity.
 *   3. Otherwise, generate a fresh one based on a random ID + timestamp.
 *
 * Using a per-device username avoids the "username duplicated" error that
 * strikes whenever multiple users share a default like `obscura-agent` —
 * Circle rejects the second registration server-side, and the auto-login
 * fallback fails on devices that don't yet have the corresponding passkey
 * stored locally (the OS dialog reports "no passkeys saved").
 */
function pickUsername(explicit?: string): string {
    if (explicit && explicit !== DEFAULT_USERNAME) return explicit;
    if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_USERNAME_KEY);
        if (cached) return cached;
    }
    // Generate a stable random username. We deliberately avoid the user's
    // address or email — passkeys are scoped to (rpId, username) so a fresh
    // ID every device-install is correct.
    const rand =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? (crypto as any).randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
    const fresh = `obscura-${rand}-${Date.now().toString(36)}`;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_USERNAME_KEY, fresh);
    }
    return fresh;
}

// ---------- types ----------

export interface CircleWalletSession {
    /** Smart Contract Account address (ERC-4337) */
    address: Address;
    /** WebAuthn passkey credential */
    credential: P256Credential;
    /** Bundler client used to submit user operations */
    bundlerClient: ReturnType<typeof createBundlerClient>;
    /** Smart account instance */
    smartAccount: Awaited<ReturnType<typeof toCircleSmartAccount>>;
    /** Public client for read calls */
    publicClient: PublicClient;
    /** Display label for the wallet */
    label: string;
}

// ---------- public API ----------

export function isCircleWalletConfigured(): boolean {
    return Boolean(CLIENT_KEY && CLIENT_URL);
}

/**
 * Register a brand-new passkey (browser shows the OS-native passkey dialog)
 * and create a Circle Smart Account on Arc Testnet. Returns the full session
 * object the rest of the app uses to read and write.
 *
 * `username` defaults to a per-device random ID (see `pickUsername`). Pass
 * an explicit value only if you specifically need to recover a specific
 * Circle-side identity.
 *
 * `preferPlatform` forces the browser to use the platform authenticator
 * (Windows Hello, Touch ID) instead of showing cross-device QR options.
 */
export async function registerCircleWallet(
    username?: string,
    preferPlatform?: boolean
): Promise<CircleWalletSession> {
    if (preferPlatform) enablePlatformAuthenticatorHint();
    try {
        return await enrollOrLogin(pickUsername(username), WebAuthnMode.Register);
    } finally {
        if (preferPlatform) disablePlatformAuthenticatorHint();
    }
}

/**
 * Log in with an existing passkey for the configured domain. The browser
 * presents the matching credentials and the user picks one.
 *
 * If `username` is omitted we use the per-device value stored in
 * localStorage so the same passkey enrollment is reused.
 */
export async function loginCircleWallet(
    username?: string
): Promise<CircleWalletSession> {
    // Try to get stored credential ID for faster lookup
    const storedCred = typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_CRED_KEY)
        : null;
    let credentialId: string | undefined;
    if (storedCred) {
        try { credentialId = JSON.parse(storedCred)?.id; } catch {}
    }
    return enrollOrLogin(pickUsername(username), WebAuthnMode.Login, credentialId);
}

/**
 * Restore the most recently used credential from localStorage so the user
 * doesn't have to redo the passkey prompt on a refresh.
 *
 * NOTE: This stores P256Credential in localStorage which is XSS-readable.
 * Acceptable for testnet demo; production should use httpOnly cookies via a
 * thin backend.
 */
export async function restoreCircleWallet(): Promise<CircleWalletSession | null> {
    if (!isCircleWalletConfigured()) return null;
    const cached = typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_CRED_KEY)
        : null;
    if (!cached) return null;
    try {
        const credential = JSON.parse(cached) as P256Credential;
        return await openSessionFromCredential(credential);
    } catch (e: any) {
        console.warn('[circleWallet] failed to restore session', e);
        // If credential is stale/invalid, clear it so user can re-enroll
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_CRED_KEY);
            localStorage.removeItem(STORAGE_USERNAME_KEY);
        }
        return null;
    }
}

export function clearCircleWalletSession() {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_CRED_KEY);
        localStorage.removeItem(STORAGE_USERNAME_KEY);
    }
}

/**
 * Submit a single contract call as a gasless user operation. Returns the
 * transaction hash recorded in the user-operation receipt — which is a
 * regular ArcScan-viewable tx hash, identical in shape to a normal EOA tx.
 */
export async function sendGaslessCall(
    session: CircleWalletSession,
    call: {
        to: Address;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
        value?: bigint;
    }
): Promise<{ userOpHash: Hex; txHash: Hex }> {
    const data = encodeFunctionData({
        abi: call.abi as any,
        functionName: call.functionName,
        args: call.args as any,
    });

    console.log('[circle] sendUserOperation', {
        smartAccount: session.address,
        to: call.to,
        functionName: call.functionName,
        value: (call.value ?? 0n).toString(),
    });

    let userOpHash: Hex;
    try {
        userOpHash = await session.bundlerClient.sendUserOperation({
            account: session.smartAccount,
            calls: [
                {
                    to: call.to,
                    value: call.value ?? 0n,
                    data,
                },
            ],
            // Sponsor gas via Circle Gas Station. On testnet this is automatic;
            // on mainnet it requires a paymaster policy in Circle Console.
            paymaster: true,
            // Arc Testnet bundler enforces a 1 gwei priority-fee floor. Viem's
            // auto-estimator usually reports 0.002 gwei which the bundler
            // rejects with `precheck failed`. Override here.
            maxPriorityFeePerGas: ARC_MIN_PRIORITY_FEE,
            maxFeePerGas: ARC_DEFAULT_MAX_FEE,
        });
    } catch (e: any) {
        console.error('[circle] sendUserOperation failed', e);
        // Re-wrap so the unified error path surfaces a useful message.
        const reason =
            e?.shortMessage ||
            e?.details ||
            e?.message ||
            'Unknown bundler error';
        throw new Error(`Circle bundler: ${reason}`);
    }

    console.log('[circle] userOpHash', userOpHash);

    const receipt = await session.bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
    });

    if (!receipt.success) {
        const reason = (receipt as any).reason ?? 'execution reverted';
        throw new Error(`Circle userOp failed: ${reason}`);
    }

    return {
        userOpHash,
        txHash: receipt.receipt.transactionHash,
    };
}

/**
 * Submit a batch of contract calls as a single gasless user operation.
 * Useful for "approve + execute" flows: the agent packs them together so the
 * user signs once.
 */
export async function sendGaslessBatch(
    session: CircleWalletSession,
    calls: Array<{
        to: Address;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
        value?: bigint;
    }>
): Promise<{ userOpHash: Hex; txHash: Hex }> {
    const encoded = calls.map((c) => ({
        to: c.to,
        value: c.value ?? 0n,
        data: encodeFunctionData({
            abi: c.abi as any,
            functionName: c.functionName,
            args: c.args as any,
        }),
    }));

    const userOpHash = await session.bundlerClient.sendUserOperation({
        account: session.smartAccount,
        calls: encoded,
        paymaster: true,
        maxPriorityFeePerGas: ARC_MIN_PRIORITY_FEE,
        maxFeePerGas: ARC_DEFAULT_MAX_FEE,
    });

    const receipt = await session.bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
    });

    return {
        userOpHash,
        txHash: receipt.receipt.transactionHash,
    };
}

/**
 * Convenience wrapper: send `amount` USDC to `to` using the gasless paymaster.
 * `amount` is in raw USDC units (6 decimals).
 */
export async function sendGaslessUsdc(
    session: CircleWalletSession,
    usdcAddress: Address,
    to: Address,
    amount: bigint
): Promise<{ userOpHash: Hex; txHash: Hex }> {
    const userOpHash = await session.bundlerClient.sendUserOperation({
        account: session.smartAccount,
        calls: [encodeTransfer(to, usdcAddress, amount)],
        paymaster: true,
        maxPriorityFeePerGas: ARC_MIN_PRIORITY_FEE,
        maxFeePerGas: ARC_DEFAULT_MAX_FEE,
    });
    const receipt = await session.bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
    });
    return {
        userOpHash,
        txHash: receipt.receipt.transactionHash,
    };
}

// ---------- internals ----------

async function enrollOrLogin(
    username: string,
    mode: WebAuthnMode,
    credentialId?: string
): Promise<CircleWalletSession> {
    if (!isCircleWalletConfigured()) {
        throw new Error(
            'Circle Modular Wallets are not configured. Set VITE_CIRCLE_CLIENT_KEY and VITE_CIRCLE_CLIENT_URL.'
        );
    }

    console.log('[circle] passkey', mode === WebAuthnMode.Register ? 'register' : 'login', {
        username,
        clientUrl: CLIENT_URL,
        origin: typeof window !== 'undefined' ? window.location.origin : '(no window)',
    });

    let credential: P256Credential;
    try {
        const passkeyTransport = toPasskeyTransport(CLIENT_URL!, CLIENT_KEY!);
        credential = await toWebAuthnCredential({
            transport: passkeyTransport,
            mode,
            username,
            ...(credentialId ? { credentialId } : {}),
        });
        console.log('[circle] passkey credential obtained', {
            id: (credential as any)?.id,
        });
    } catch (e: any) {
        const name = e?.name ?? 'UnknownError';
        const detail = e?.message ?? e?.shortMessage ?? String(e);
        console.error('[circle] passkey enrollment failed', { name, detail, raw: e });

        // "Invalid credentials" from viem/Circle means the stored passkey
        // doesn't match what Circle's server expects (domain change, key
        // rotation, or corrupted localStorage). Clear stale state so the
        // user can try fresh.
        if (detail.includes('Invalid credentials') || detail.includes('invalid credential')) {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(STORAGE_CRED_KEY);
                localStorage.removeItem(STORAGE_USERNAME_KEY);
            }
            throw new Error(
                'Passkey credentials expired or invalid. Stale session cleared — please try "Create new passkey" again.'
            );
        }

        throw e;
    }

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_CRED_KEY, JSON.stringify(credential));
        localStorage.setItem(STORAGE_USERNAME_KEY, username);
    }

    return openSessionFromCredential(credential, username);
}

async function openSessionFromCredential(
    credential: P256Credential,
    label?: string
): Promise<CircleWalletSession> {
    if (!isCircleWalletConfigured()) {
        throw new Error('Circle Modular Wallets are not configured.');
    }

    const modularTransport = toModularTransport(
        `${CLIENT_URL}/${ARC_TESTNET_PATH}`,
        CLIENT_KEY!
    );

    const publicClient = createPublicClient({
        chain: arcTestnet as any,
        transport: modularTransport,
    });

    const owner = toWebAuthnAccount({ credential });

    let smartAccount;
    try {
        smartAccount = await toCircleSmartAccount({
            client: publicClient,
            owner,
        });
    } catch (e: any) {
        const msg = e?.message ?? String(e);
        if (msg.includes('Invalid credentials') || msg.includes('invalid credential') || msg.includes('entity config')) {
            // Clear stale credential
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(STORAGE_CRED_KEY);
                localStorage.removeItem(STORAGE_USERNAME_KEY);
            }
            throw new Error(
                'Circle rejected the credential. This passkey may have been created on a different domain or client key. Please create a new passkey.'
            );
        }
        throw e;
    }

    const bundlerClient = createBundlerClient({
        smartAccount,
        chain: arcTestnet as any,
        transport: modularTransport,
    });

    return {
        address: smartAccount.address,
        credential,
        bundlerClient,
        smartAccount,
        publicClient: publicClient as PublicClient,
        label: label ?? DEFAULT_USERNAME,
    };
}

// ---------- platform authenticator hint ----------
// Circle's SDK doesn't expose authenticatorAttachment. We temporarily patch
// navigator.credentials.create to inject { authenticatorSelection:
// { authenticatorAttachment: "platform" } } so the browser prefers Windows
// Hello / Touch ID over cross-device QR.

let originalCreate: typeof navigator.credentials.create | null = null;
let originalGet: typeof navigator.credentials.get | null = null;

function enablePlatformAuthenticatorHint() {
    if (typeof window === 'undefined' || !navigator?.credentials) return;
    originalCreate = navigator.credentials.create.bind(navigator.credentials);
    (navigator.credentials as any).create = async (options: any) => {
        if (options?.publicKey) {
            options.publicKey.authenticatorSelection = {
                ...options.publicKey.authenticatorSelection,
                authenticatorAttachment: 'platform',
            };
        }
        return originalCreate!(options);
    };
}

function disablePlatformAuthenticatorHint() {
    if (originalCreate && typeof window !== 'undefined' && navigator?.credentials) {
        navigator.credentials.create = originalCreate;
        originalCreate = null;
    }
}

function enablePlatformGetHint() {
    if (typeof window === 'undefined' || !navigator?.credentials) return;
    originalGet = navigator.credentials.get.bind(navigator.credentials);
    (navigator.credentials as any).get = async (options: any) => {
        if (options?.publicKey) {
            // Prefer platform authenticator (Windows Hello) over cross-device
            options.publicKey.authenticatorAttachment = 'platform';
        }
        return originalGet!(options);
    };
}

function disablePlatformGetHint() {
    if (originalGet && typeof window !== 'undefined' && navigator?.credentials) {
        navigator.credentials.get = originalGet;
        originalGet = null;
    }
}
