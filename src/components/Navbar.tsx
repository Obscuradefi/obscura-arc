import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToApp = () => navigate('/app');

  return (
    <>
      <nav className={`obscura-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-logo" onClick={() => navigate('/')}>
          <img src="/assets/2.png" alt="Obscura Logo" style={{ height: '26px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: "'MADE Future X Header', sans-serif", color: 'var(--green-400)', letterSpacing: '1px' }}>OBSCURA</span>
        </div>

        <div className="nav-actions">
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <img
              src={theme === 'dark' ? '/assets/aapl.png' : '/assets/aapl2.png'}
              alt="Theme toggle"
              style={{ height: '22px', width: 'auto', objectFit: 'contain' }}
            />
          </button>
          <a href="/docs" className="nav-link-item" style={{ textDecoration: 'none' }}>Docs</a>
          <ConnectButton.Custom>
            {({ account, openConnectModal, mounted }) => {
              if (!mounted) return null;
              if (!account) {
                return (
                  <button className="nav-launch-btn" onClick={openConnectModal}>
                    Launch app
                  </button>
                );
              }
              return (
                <button className="nav-launch-btn" onClick={goToApp}>
                  Launch app
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
