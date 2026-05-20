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
 * Obscura supports two auth systems:
 *   1. Circle Modular Wallets — passkey-secured smart account on Arc
 *   2. RainbowKit / wagmi — standard EOA (MetaMask, WalletConnect, Rabby, etc.)
 *
 * Circle takes priority because passkey enrollment is a deliberate action.
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
