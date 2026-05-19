import React from 'react';

export type TabId = 'shield' | 'swap' | 'stake' | 'portfolio' | 'markets' | 'liquidity' | 'bridge';

interface AppTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const AppTabs: React.FC<AppTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'swap', label: 'Swap' },
    { id: 'shield', label: 'Vault' },
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
