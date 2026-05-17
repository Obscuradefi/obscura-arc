import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useNavigate } from 'react-router-dom';
import CircleWalletButton from './CircleWalletButton';
import WakeUpOracle from './WakeUpOracle';

const AppHeader: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div
        className="app-logo"
        onClick={() => navigate('/')}
        style={{ cursor: 'pointer' }}
      >
        <img src="/assets/2.png" alt="Obscura Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
        <span style={{ fontFamily: "'MADE Future X Header', sans-serif", fontSize: '0.85rem', color: 'var(--green-400)', letterSpacing: '1px' }}>OBSCURA</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--text-dim)',
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--glass-border)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Arc Testnet
        </div>

        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'rgba(61,158,78,0.08)',
            border: '1px solid rgba(61,158,78,0.25)',
            color: 'var(--green-300)',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
            textDecoration: 'none',
          }}
        >
          Faucet
        </a>

        <WakeUpOracle />
        <CircleWalletButton />
        <ConnectButton />
      </div>
    </header>
  );
};

export default AppHeader;
