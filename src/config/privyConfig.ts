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
 *   - Email + Google + Apple + Wallet at the top
 *   - `detected_wallets` puts every EIP-1193 / EIP-6963 provider injected by
 *     the browser at the top of the wallet picker, including Rabby, Brave,
 *     Trust, Frame, OKX, Phantom (EVM), etc. Without this, Privy only shows
 *     MetaMask/Coinbase/WalletConnect by default.
 *   - The `walletList` order below puts detected_wallets FIRST so any
 *     extension the user actually has installed shows up at the top, with
 *     well-known fallbacks underneath in case detection misses one.
 *   - Embedded wallet auto-created for users without one (email/Google
 *     login -> instant wallet)
 *   - Arc Testnet as default + only chain so users can't accidentally
 *     land on Ethereum mainnet
 */
export const PRIVY_CONFIG = {
    appearance: {
        theme: 'dark' as const,
        accentColor: '#3D9E4E',
        logo: '/assets/2.png',
        walletList: [
            // Detected first — covers any EIP-6963 announce (Rabby, Brave,
            // Trust, Frame, Phantom-EVM, OKX, Zerion, etc.).
            'detected_wallets',
            // Then named fallbacks for the popular wallets users still
            // expect to see by name even if the EIP-6963 announce missed.
            'metamask',
            'rabby_wallet',
            'coinbase_wallet',
            'rainbow',
            'phantom',
            'okx_wallet',
            'wallet_connect',
        ] as Array<
            | 'detected_wallets'
            | 'metamask'
            | 'wallet_connect'
            | 'coinbase_wallet'
            | 'rainbow'
            | 'rabby_wallet'
            | 'phantom'
            | 'okx_wallet'
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
