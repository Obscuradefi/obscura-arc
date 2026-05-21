import React from 'react';
import { useNavigate } from 'react-router-dom';
import WakeUpOracle from './WakeUpOracle';
import UnifiedConnectButton from './UnifiedConnectButton';
import { useTheme } from '../hooks/useTheme';

interface AppHeaderProps {
  onFaucetClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onFaucetClick }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="app-header">
      <div className="app-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <img src="/assets/2.png" alt="Obscura Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
        <span style={{ fontFamily: "'MADE Future X Header', sans-serif", fontSize: '0.85rem', color: 'var(--green-400)', letterSpacing: '1px' }}>OBSCURA</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={toggleTheme} className="theme-toggle-btn" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <img src={theme === 'dark' ? '/assets/aapl.png' : '/assets/aapl2.png'} alt="Theme toggle" style={{ height: '20px', width: 'auto', objectFit: 'contain' }} />
        </button>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', padding: '5px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-pill)', border: '1px solid var(--glass-border)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Arc Testnet
        </div>
        {onFaucetClick ? (
          <button onClick={onFaucetClick} style={{ background: 'rgba(61,158,78,0.08)', border: '1px solid rgba(61,158,78,0.25)', color: 'var(--green-300)', fontSize: '0.78rem', fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.02em' }} title="Mint a mock token">
            Faucet
          </button>
        ) : (
          <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(61,158,78,0.08)', border: '1px solid rgba(61,158,78,0.25)', color: 'var(--green-300)', fontSize: '0.78rem', fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.02em', textDecoration: 'none' }}>
            Faucet
          </a>
        )}
        <WakeUpOracle />
        <UnifiedConnectButton />
      </div>
    </header>
  );
};

export default AppHeader;