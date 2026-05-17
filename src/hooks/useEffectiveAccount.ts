import { useAccount } from 'wagmi';
import { useCircleWallet } from './useCircleWallet';

export type AccountSource = 'circle' | 'wagmi';

export interface EffectiveAccount {
    address: `0x${string}` | undefined;
    isConnected: boolean;
    source: AccountSource | null;
}

/**
 * Single source of truth for "who is the user".
 *
 * Obscura supports two parallel auth systems:
 *   1. RainbowKit / wagmi — standard EOA (MetaMask, WalletConnect, Coinbase)
 *   2. Circle Modular Wallets — passkey-secured smart account on Arc
 *
 * This hook returns whichever is currently active. Circle takes priority
 * because the user explicitly opted into it (passkey enrollment is a
 * deliberate action), so when both are connected we surface the smart
 * account.
 *
 * Every component that previously called `useAccount()` from wagmi should
 * use this instead. Then balance reads, approvals, and tx submission all
 * route to the right address regardless of which login method the user
 * picked.
 */
export function useEffectiveAccount(): EffectiveAccount {
    const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
    const { session } = useCircleWallet();

    if (session) {
        return {
            address: session.address,
            isConnected: true,
            source: 'circle',
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
