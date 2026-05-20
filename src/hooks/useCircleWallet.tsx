// React context for the active Circle Modular Wallet session.
//
// The rest of the app reads `useCircleWallet()` to find out whether a
// gasless smart-account session exists and, if so, to submit user operations
// through it. The provider:
//   - tries `restoreCircleWallet()` once on mount (silent reconnect)
//   - exposes `register`, `login`, and `disconnect` so the connect button
//     can drive enrollment from a single place
//   - re-throws errors with friendly messages so the UI can surface them

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
    CircleWalletSession,
    isCircleWalletConfigured,
    loginCircleWallet,
    registerCircleWallet,
    restoreCircleWallet,
    clearCircleWalletSession,
} from '../lib/circleWallet';

interface CircleWalletContextValue {
    session: CircleWalletSession | null;
    isConfigured: boolean;
    isConnecting: boolean;
    error: string | null;
    register: (username?: string, preferPlatform?: boolean) => Promise<void>;
    login: (username?: string) => Promise<void>;
    disconnect: () => void;
}

const CircleWalletContext = createContext<CircleWalletContextValue | null>(null);

export const CircleWalletProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [session, setSession] = useState<CircleWalletSession | null>(null);
    const [isConnecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isConfigured = isCircleWalletConfigured();

    // Silent reconnect on mount — if the user already enrolled before, we can
    // bring back the session without prompting for the passkey again because
    // the credential metadata is in localStorage. (The next signing operation
    // still triggers the passkey prompt, since the actual private key never
    // leaves the secure element.)
    useEffect(() => {
        if (!isConfigured) return;
        let cancelled = false;
        (async () => {
            try {
                const restored = await restoreCircleWallet();
                if (!cancelled && restored) setSession(restored);
            } catch (e) {
                console.warn('[circleWallet] restore failed', e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isConfigured]);

    const register = useCallback(async (username?: string, preferPlatform?: boolean) => {
        if (!isConfigured) {
            setError('Circle Modular Wallets are not configured. See lanjut.md.');
            return;
        }
        setConnecting(true);
        setError(null);
        try {
            const s = await registerCircleWallet(username, preferPlatform);
            setSession(s);
        } catch (e: any) {
            const msg = String(e?.message ?? e ?? '').toLowerCase();
            const isDuplicate =
                msg.includes('username is duplicated') ||
                msg.includes('already registered') ||
                msg.includes('already exists') ||
                e?.name === 'InvalidStateError';

            if (isDuplicate) {
                // Username taken → auto-fallback to login
                console.log('[circle] username taken, falling back to login');
                try {
                    const s = await loginCircleWallet(username);
                    setSession(s);
                    setError(null);
                    return;
                } catch (loginErr: any) {
                    // Login also failed — clear stored username so next attempt generates fresh
                    if (typeof localStorage !== 'undefined') {
                        localStorage.removeItem('obscura:circle:username');
                        localStorage.removeItem('obscura:circle:credential');
                    }
                    setError('Passkey not found on this device. Cleared stale data — try "Create new passkey" again.');
                    return;
                }
            }

            setError(friendlyError(e));
            throw e;
        } finally {
            setConnecting(false);
        }
    }, [isConfigured]);

    const login = useCallback(async (username?: string) => {
        if (!isConfigured) {
            setError('Circle Modular Wallets are not configured. See lanjut.md.');
            return;
        }
        setConnecting(true);
        setError(null);
        try {
            const s = await loginCircleWallet(username);
            setSession(s);
        } catch (e: any) {
            setError(friendlyError(e));
            throw e;
        } finally {
            setConnecting(false);
        }
    }, [isConfigured]);

    const disconnect = useCallback(() => {
        clearCircleWalletSession();
        setSession(null);
        setError(null);
    }, []);

    return (
        <CircleWalletContext.Provider
            value={{ session, isConfigured, isConnecting, error, register, login, disconnect }}
        >
            {children}
        </CircleWalletContext.Provider>
    );
};

export function useCircleWallet(): CircleWalletContextValue {
    const ctx = useContext(CircleWalletContext);
    if (!ctx) {
        throw new Error('useCircleWallet must be used inside <CircleWalletProvider>');
    }
    return ctx;
}

function friendlyError(e: any): string {
    const name = e?.name ?? '';
    const msg = e?.message ?? String(e);
    if (name === 'NotAllowedError') return 'Passkey prompt was cancelled.';
    if (name === 'SecurityError') return 'Passkey domain mismatch. Check your Circle Console settings.';
    if (name === 'InvalidStateError') return 'A passkey for this username already exists. Try logging in instead.';
    if (msg.includes('username is duplicated') || msg.includes('username already taken'))
        return 'Username already exists. Sign in with the existing passkey instead.';
    if (msg.includes('Invalid credentials') || msg.includes('invalid credential'))
        return 'Passkey invalid or expired. Stale data cleared — try "Create new passkey".';
    if (msg.includes('Stale session cleared'))
        return 'Passkey expired. Please try "Create new passkey" again.';
    if (msg.includes('entity config'))
        return 'Circle has not enabled Arc Testnet for this client key yet. Use RainbowKit wallet instead.';
    if (msg.includes('155507')) return 'Modular Wallets do not yet support this chain.';
    if (msg.includes('155509')) return 'A paymaster policy is required in the Circle Console.';
    return msg;
}
