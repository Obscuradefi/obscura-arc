import React from 'react';

export type TabId = 'shield' | 'swap' | 'stake' | 'portfolio' | 'markets' | 'liquidity' | 'bridge' | 'shadow' | 'x402' | 'agents';

interface AppTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const AppTabs: React.FC<AppTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: TabId; label: string; disabled?: boolean; badge?: string }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'swap', label: 'Swap' },
    { id: 'shield', label: 'Vault' },
    { id: 'agents', label: 'Agents', badge: 'new' },
    { id: 'shadow', label: 'Shadow', badge: 'new' },
    { id: 'x402', label: 'x402', badge: 'new' },
    { id: 'markets', label: 'Markets' },
    { id: 'liquidity', label: 'Liquidity' },
    { id: 'stake', label: 'Stake', disabled: true },
    { id: 'bridge', label: 'Bridge', disabled: true },
  ];

  return (
    <div className="app-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`app-tab-btn${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          data-disabled={tab.disabled ? 'true' : 'false'}
          disabled={tab.disabled}
        >
          {tab.label}
          {tab.badge && (
            <span
              style={{
                fontSize: '0.55rem',
                marginLeft: 6,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(167,139,250,0.15)',
                color: '#A78BFA',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                verticalAlign: 'middle',
              }}
            >
              {tab.badge}
            </span>
          )}
          {tab.disabled && (
            <span
              style={{
                fontSize: '0.58rem',
                marginLeft: 5,
                color: 'var(--text-dim)',
                verticalAlign: 'super',
                letterSpacing: '0.04em',
              }}
            >
              soon
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default AppTabs;
