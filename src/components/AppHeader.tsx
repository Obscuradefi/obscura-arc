import React from 'react';
import { useNavigate } from 'react-router-dom';
import CircleWalletButton from './CircleWalletButton';
import PrivyLoginButton from './PrivyLoginButton';
import WakeUpOracle from './WakeUpOracle';
import { isPrivyConfigured } from '../config/privyConfig';

interface AppHeaderProps {
  /** Optional: when provided, the Faucet button mints a mock token. */
  onFaucetClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onFaucetClick }) => {
  const navigate = useNavigate();
  const privyAvailable = isPrivyConfigured();

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

        {onFaucetClick ? (
          <button
            onClick={onFaucetClick}
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
            }}
            title="Mint a mock token (cycles through GOLD/AAPL/MSTR/JPYC). For USDC, visit faucet.circle.com."
          >
            Faucet
          </button>
        ) : (
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
        )}

        <WakeUpOracle />
        <CircleWalletButton />
        {/*
         * One "Sign in" button only. When Privy is configured we let it
         * handle BOTH email/Google/Apple AND every injected wallet via
         * `detected_wallets`, so Rabby / MetaMask / Coinbase / Trust all
         * show up in the same modal. RainbowKit is hidden in that path.
         * Falls back to RainbowKit when Privy isn't configured.
         */}
        {privyAvailable ? (
          <PrivyLoginButton />
        ) : (
          <RainbowFallback />
        )}
      </div>
    </header>
  );
};

// Lazy import RainbowKit's button only when Privy isn't available so we
// don't ship two parallel connect modals.
const RainbowFallback: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ConnectButton } = require('@rainbow-me/rainbowkit');
  return <ConnectButton />;
};

export default AppHeader;
