// Privy authentication configuration for Obscura.
//
// Privy provides a third login path alongside RainbowKit (EOA) and Circle
// Modular Wallets (passkey). It targets users without crypto wallets:
//   - Email login -> embedded wallet auto-created
//   - Google / Apple OAuth -> embedded wallet
//   - Optional: still supports MetaMask / WalletConnect via Privy's own
//     wallet connector
//
// We keep the existing RainbowKit + Circle paths intact. Privy's embedded
// wallet shows up alongside the others and `useEffectiveAccount` decides
// which one to surface based on priority.

import { arcTestnet } from '../wagmi';

const APP_ID =
    (import.meta as any).env?.VITE_PRIVY_APP_ID ||
    // Sentinel that fails fast in production builds. The UI hides Privy
    // login when this is missing.
    '';

export const PRIVY_APP_ID = APP_ID;

export function isPrivyConfigured(): boolean {
    return Boolean(PRIVY_APP_ID);
}

/**
 * Privy provider config. Tuned for an "agent-friendly" onboarding:
 *   - Email + Google + Apple at the top
 *   - Embedded wallet auto-created for users without one
 *   - Arc Testnet as the default + only chain (we don't want users
 *     accidentally landing on Ethereum mainnet)
 *   - Hide unused login options to keep the modal compact
 */
export const PRIVY_CONFIG = {
    appearance: {
        theme: 'dark' as const,
        accentColor: '#3D9E4E',
        logo: '/assets/2.png',
        walletList: ['detected_wallets', 'metamask', 'wallet_connect'] as Array<
            'detected_wallets' | 'metamask' | 'wallet_connect' | 'coinbase_wallet'
        >,
    },
    loginMethods: ['email', 'google', 'apple', 'wallet'] as Array<
        'email' | 'google' | 'apple' | 'wallet'
    >,
    embeddedWallets: {
        ethereum: {
            createOnLogin: 'users-without-wallets' as const,
        },
    },
    defaultChain: arcTestnet,
    supportedChains: [arcTestnet],
};
