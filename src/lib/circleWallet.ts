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
const ARC_TESTNET_PATH = 'arcTestnet';

const STORAGE_CRED_KEY = 'obscura:circle:credential';

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
 */
export async function registerCircleWallet(
    username: string = DEFAULT_USERNAME
): Promise<CircleWalletSession> {
    return enrollOrLogin(username, WebAuthnMode.Register);
}

/**
 * Log in with an existing passkey for the configured domain. The browser
 * presents the matching credentials and the user picks one.
 */
export async function loginCircleWallet(
    username: string = DEFAULT_USERNAME
): Promise<CircleWalletSession> {
    return enrollOrLogin(username, WebAuthnMode.Login);
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
    } catch (e) {
        console.warn('[circleWallet] failed to restore session', e);
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_CRED_KEY);
        }
        return null;
    }
}

export function clearCircleWalletSession() {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_CRED_KEY);
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
    mode: WebAuthnMode
): Promise<CircleWalletSession> {
    if (!isCircleWalletConfigured()) {
        throw new Error(
            'Circle Modular Wallets are not configured. Set VITE_CIRCLE_CLIENT_KEY and VITE_CIRCLE_CLIENT_URL.'
        );
    }

    const passkeyTransport = toPasskeyTransport(CLIENT_URL!, CLIENT_KEY!);
    const credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode,
        username,
    });

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_CRED_KEY, JSON.stringify(credential));
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

    const smartAccount = await toCircleSmartAccount({
        client: publicClient,
        owner,
    });

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
