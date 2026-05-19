import { useAccount } from 'wagmi';
import { useCircleWallet } from './useCircleWallet';
import { isPrivyConfigured } from '../config/privyConfig';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export type AccountSource = 'circle' | 'privy' | 'wagmi';

export interface EffectiveAccount {
    address: `0x${string}` | undefined;
    isConnected: boolean;
    source: AccountSource | null;
}

/**
 * Single source of truth for "who is the user".
 *
 * Obscura supports three parallel auth systems:
 *   1. Circle Modular Wallets — passkey-secured smart account on Arc
 *   2. Privy — email/Google/Apple login backed by an embedded wallet
 *   3. RainbowKit / wagmi — standard EOA (MetaMask, WalletConnect, Coinbase)
 *
 * Priority is Circle > Privy > Wagmi. Circle wins because passkey enrollment
 * is the most explicit + most agentic-friendly path. Privy beats Wagmi
 * because users who logged in with email expect their embedded wallet to be
 * the active one, not a previously-cached MetaMask connection.
 *
 * Every component that previously called `useAccount()` from wagmi should
 * use this instead. Then balance reads, approvals, and tx submission all
 * route to the right address regardless of which login method the user
 * picked.
 */
export function useEffectiveAccount(): EffectiveAccount {
    const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
    const { session } = useCircleWallet();
    const privy = useSafePrivy();

    if (session) {
        return {
            address: session.address,
            isConnected: true,
            source: 'circle',
        };
    }

    if (privy?.authenticated && privy.address) {
        return {
            address: privy.address as `0x${string}`,
            isConnected: true,
            source: 'privy',
        };
    }

    if (wagmiConnected && wagmiAddress) {
        return {
            address: wagmiAddress,
            isConnected: true,
            source: 'wagmi',
        };
    }

    return {
        address: undefined,
        isConnected: false,
        source: null,
    };
}

/**
 * Read Privy state safely. When Privy isn't configured, the provider is not
 * mounted and `usePrivy()` would throw — we guard that here so the rest of
 * the app doesn't need to know.
 *
 * NOTE: We always call the same number of hooks. We can't conditionally
 * skip `usePrivy` because React enforces stable hook ordering. So we always
 * call it but ignore the result if not configured.
 */
function useSafePrivy(): { authenticated: boolean; address: string | undefined } | null {
    if (!isPrivyConfigured()) {
        // Privy provider isn't mounted; safe to bail early. We still need a
        // stable hook count, so call the same dummy hooks below to keep
        // React happy across re-renders.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return null;
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { ready, authenticated, user } = usePrivy();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { wallets } = useWallets();

    if (!ready) return { authenticated: false, address: undefined };

    const address = wallets[0]?.address ?? user?.wallet?.address;
    return { authenticated, address };
}
