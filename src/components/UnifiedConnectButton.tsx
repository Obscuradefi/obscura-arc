import React, { useState, useRef, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { useCircleWallet } from '../hooks/useCircleWallet';

const UnifiedConnectButton: React.FC = () => {
    const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
    const { disconnect: wagmiDisconnect } = useDisconnect();
    const { session, isConnecting, error, register, login, disconnect: circleDisconnect } = useCircleWallet();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Already connected via Circle
    if (session) {
        const short = `${session.address.slice(0, 6)}...${session.address.slice(-4)}`;
        return (
            <div style={{ position: 'relative' }} ref={menuRef}>
                <button onClick={() => setShowMenu(s => !s)} style={connectedStyle('#5FBFFF')}>
                    Passkey {short}
                </button>
                {showMenu && (
                    <div style={menuStyle}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 6 }}>Circle Smart Account (gasless)</div>
                        <code style={{ display: 'block', fontSize: '0.68rem', color: '#5FBFFF', wordBreak: 'break-all', marginBottom: 8 }}>{session.address}</code>
                        <button onClick={() => { circleDisconnect(); setShowMenu(false); }} style={disconnectBtnStyle}>Disconnect</button>
                    </div>
                )}
            </div>
        );
    }

    // Already connected via wagmi/RainbowKit
    if (wagmiConnected && wagmiAddress) {
        const short = `${wagmiAddress.slice(0, 6)}...${wagmiAddress.slice(-4)}`;
        return (
            <div style={{ position: 'relative' }} ref={menuRef}>
                <button onClick={() => setShowMenu(s => !s)} style={connectedStyle('var(--green-400)')}>
                    {short}
                </button>
                {showMenu && (
                    <div style={menuStyle}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 6 }}>External Wallet (EOA)</div>
                        <code style={{ display: 'block', fontSize: '0.68rem', color: 'var(--green-300)', wordBreak: 'break-all', marginBottom: 8 }}>{wagmiAddress}</code>
                        <button onClick={() => { wagmiDisconnect(); setShowMenu(false); }} style={disconnectBtnStyle}>Disconnect</button>
                    </div>
                )}
            </div>
        );
    }

    // Not connected — show unified connect menu
    return (
        <div style={{ position: 'relative' }} ref={menuRef}>
            <button
                onClick={() => setShowMenu(s => !s)}
                disabled={isConnecting}
                style={{
                    background: 'var(--green-900)',
                    border: '1px solid var(--green-700)',
                    color: 'var(--green-300)',
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: isConnecting ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
            {showMenu && !isConnecting && (
                <div style={menuStyle}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
                        Choose how to connect to Arc Testnet
                    </div>
                    <button
                        onClick={async () => { setShowMenu(false); try { await register(); } catch {} }}
                        style={optionBtnStyle('#5FBFFF')}
                    >
                        <span style={{ fontWeight: 700 }}>Circle Passkey</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Gasless smart account</span>
                    </button>
                    <button
                        onClick={async () => { setShowMenu(false); try { await login(); } catch {} }}
                        style={{ ...optionBtnStyle('#5FBFFF'), background: 'transparent', borderColor: 'rgba(95,191,255,0.2)' }}
                    >
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Use existing passkey</span>
                    </button>
                    <ConnectButton.Custom>
                        {({ openConnectModal, mounted }) => {
                            if (!mounted) return null;
                            return (
                                <button
                                    onClick={() => { setShowMenu(false); openConnectModal(); }}
                                    style={optionBtnStyle('var(--green-400)')}
                                >
                                    <span style={{ fontWeight: 700 }}>External Wallet</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>MetaMask, Rabby, etc.</span>
                                </button>
                            );
                        }}
                    </ConnectButton.Custom>
                    {error && <div style={{ fontSize: '0.68rem', color: '#FF8888', marginTop: 6 }}>{error}</div>}
                </div>
            )}
        </div>
    );
};

const connectedStyle = (color: string): React.CSSProperties => ({
    background: `${color}15`,
    border: `1px solid ${color}`,
    color,
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
});

const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '110%',
    right: 0,
    background: 'rgba(13,13,18,0.97)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    minWidth: 260,
    zIndex: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const optionBtnStyle = (color: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    marginBottom: 8,
    borderRadius: 8,
    border: `1px solid ${color}40`,
    background: `${color}10`,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    textAlign: 'left',
    color,
    fontSize: '0.78rem',
    transition: 'all 0.2s',
});

const disconnectBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    background: 'rgba(255,68,68,0.08)',
    border: '1px solid rgba(255,68,68,0.3)',
    color: '#FF8888',
    borderRadius: 6,
    fontSize: '0.74rem',
    cursor: 'pointer',
    fontWeight: 600,
};

export default UnifiedConnectButton;