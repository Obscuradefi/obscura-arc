import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import AppTabs, { TabId } from '../components/AppTabs';
import Footer from '../components/Footer';
import SwapTab from '../features/swap/SwapTab';
import StakeTab from '../features/stake/StakeTab';
import PortfolioTab from '../features/portfolio/PortfolioTab';
import MarketsTab from '../features/markets/MarketsTab';
import LiquidityTab from '../features/liquidity/LiquidityTab';
import SwapAgent from '../features/swap/SwapAgent';
import ShieldTab from '../features/shield/ShieldTab';
import ShadowActivityTab from '../features/shadow/ShadowActivityTab';
import X402Tab from '../features/x402/X402Tab';
import MultiAgentOrchestratorTab from '../features/agents/MultiAgentOrchestratorTab';
import { addActivity } from '../lib/fluxMock';
import { useLiveActivitySync } from '../hooks/useLiveActivitySync';
import { useEffectiveAccount } from '../hooks/useEffectiveAccount';
import { useUnifiedSendTx } from '../hooks/useUnifiedSendTx';
import { ERC20_ABI } from '../config/dexConfig';
import { MOCK_TOKENS, type MockTokenSymbol } from '../config/arc';

const VALID_TABS: TabId[] = ['shield', 'swap', 'stake', 'portfolio', 'markets', 'liquidity', 'bridge', 'shadow', 'x402', 'agents'];

// Mock-token symbols that expose a public mint() faucet on Arc Testnet.
// USDC + EURC are funded from https://faucet.circle.com (real Circle faucet)
// so they are not part of this list. Symbols are derived from the live
// MOCK_TOKENS map so the list stays in sync with the deploy script.
const FAUCET_TOKENS: MockTokenSymbol[] = Object.keys(MOCK_TOKENS) as MockTokenSymbol[];

const AppPage: React.FC = () => {
  useLiveActivitySync();

  const [searchParams] = useSearchParams();
  const initialTab = VALID_TABS.includes(searchParams.get('tab') as TabId)
    ? (searchParams.get('tab') as TabId)
    : 'portfolio';

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { address, isConnected } = useEffectiveAccount();
  const { send } = useUnifiedSendTx();

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
  };

  const handleFaucetClick = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet (or sign in with Circle Passkey) first.');
      return;
    }
    if (FAUCET_TOKENS.length === 0) {
      alert('No mock tokens deployed yet. Run `npm run deploy:arc` first.');
      return;
    }

    // Cycle through mock-asset faucets so users can claim each in turn.
    // Index is persisted in localStorage so subsequent clicks pick the next one.
    const idx = Number(localStorage.getItem('obscura:faucetIdx') || '0') % FAUCET_TOKENS.length;
    const sym = FAUCET_TOKENS[idx];
    localStorage.setItem('obscura:faucetIdx', String((idx + 1) % FAUCET_TOKENS.length));

    const token = MOCK_TOKENS[sym];
    if (!token || token.address === '0x0000000000000000000000000000000000000000') {
      alert(
        'Mock tokens are not deployed yet. Run `npm run deploy:arc` first.\n\n' +
        'For USDC (the gas token), use https://faucet.circle.com (Arc Testnet).'
      );
      return;
    }

    try {
      // The MockToken faucet is `mint()` (no args, mints to msg.sender). For
      // EOA signers msg.sender == user. For Circle Smart Accounts msg.sender
      // is the smart account, so the minted balance lands on the smart
      // account address — which is exactly what we want.
      await send({
        to: token.address,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [],
      });
      addActivity({ type: 'faucet', description: `Minted mock ${sym} from faucet` });
    } catch (e) {
      console.error('Faucet minting failed', e);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'shield': return <ShieldTab />;
      case 'swap': return <SwapTab />;
      case 'stake': return <StakeTab />;
      case 'portfolio': return <PortfolioTab onNavigate={handleTabChange} />;
      case 'markets': return <MarketsTab onSwapClick={() => handleTabChange('swap')} />;
      case 'liquidity': return <LiquidityTab />;
      case 'shadow': return <ShadowActivityTab />;
      case 'x402': return <X402Tab />;
      case 'agents': return <MultiAgentOrchestratorTab />;
      default: return null;
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>

      <div className="site-wrapper" style={{ position: 'relative', zIndex: 1 }}>
        <AppHeader onFaucetClick={handleFaucetClick} />

        <div style={{ paddingTop: 80, minHeight: '100vh' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 0' }}>
            <AppTabs activeTab={activeTab} onTabChange={handleTabChange} />

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
            >
              {renderTabContent()}
            </motion.div>
          </div>

          <Footer />
        </div>
      </div>

      <SwapAgent />
    </div>
  );
};

export default AppPage;
