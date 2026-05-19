// Compact login button for Privy.
//
// Hidden when `VITE_PRIVY_APP_ID` isn't configured so deploys without Privy
// keys don't show a broken button.
//
// When connected, displays the embedded wallet address; clicking opens a
// dropdown with disconnect.

import React, { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { isPrivyConfigured } from '../config/privyConfig';

const PrivyLoginButton: React.FC = () => {
    if (!isPrivyConfigured()) return null;

    return <PrivyLoginInner />;
};

// Split inner so the hooks aren't called when Privy provider isn't mounted.
const PrivyLoginInner: React.FC = () => {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const { wallets } = useWallets();
    const [showMenu, setShowMenu] = useState(false);

    if (!ready) {
        return (
            <button disabled style={baseStyle({ disabled: true })}>
                Privy …
            </button>
        );
    }

    if (authenticated) {
        const wallet = wallets[0];
        const addr = wallet?.address || user?.wallet?.address;
        const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '0x???';

        return (
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowMenu((s) => !s)}
                    style={baseStyle({ active: true })}
                    title={addr}
                >
                    Privy · {short}
                </button>
                {showMenu && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '110%',
                            right: 0,
                            background: 'rgba(13,13,18,0.97)',
                            border: '1px solid rgba(167,139,250,0.3)',
                            borderRadius: 10,
                            padding: 10,
                            minWidth: 240,
                            zIndex: 200,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-dim)',
                                marginBottom: 6,
                            }}
                        >
                            Privy embedded wallet
                            {user?.email?.address ? ` · ${user.email.address}` : ''}
                            {user?.google?.email ? ` · ${user.google.email}` : ''}
                        </div>
                        <code
                            style={{
                                display: 'block',
                                fontSize: '0.7rem',
                                color: '#A78BFA',
                                wordBreak: 'break-all',
                                marginBottom: 8,
                            }}
                        >
                            {addr}
                        </code>
                        <button
                            onClick={() => {
                                logout();
                                setShowMenu(false);
                            }}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                background: 'rgba(255,68,68,0.08)',
                                border: '1px solid rgba(255,68,68,0.3)',
                                color: '#FF8888',
                                borderRadius: 6,
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            Disconnect
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <button onClick={() => login()} style={baseStyle({})}>
            Sign in with email
        </button>
    );
};

function baseStyle({ active = false, disabled = false }: { active?: boolean; disabled?: boolean }): React.CSSProperties {
    return {
        background: active ? 'rgba(167,139,250,0.15)' : 'rgba(167,139,250,0.06)',
        border: `1px solid ${active ? '#A78BFA' : 'rgba(167,139,250,0.3)'}`,
        color: '#A78BFA',
        padding: '8px 14px',
        borderRadius: 10,
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
    };
}

export default PrivyLoginButton;
