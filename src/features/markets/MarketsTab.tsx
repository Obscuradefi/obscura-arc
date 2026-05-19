import React from 'react';
import { motion } from 'framer-motion';
import { FLUX_ASSETS } from '../../data/fluxAssets';
import { MOCK_MARKETS } from '../../data/mockMarkets';
import { useMultiplePriceFeeds } from '../../hooks/usePriceFeed';

/**
 * Format a USD price with a precision that scales to the magnitude:
 *   ≥1       -> 2 decimals (e.g. $4,500.00, $1.08)
 *   0.01–1   -> 4 decimals (e.g. $0.0667)
 *   <0.01    -> 6 decimals (e.g. $0.006667 for JPYC at ~150 yen/USD)
 *
 * Otherwise stables-paired-against-USD assets like JPYC end up rounded to
 * "$0.01" which loses the actual exchange-rate signal. Same helper used in
 * Portfolio + Markets so display stays consistent.
 */
function formatPrice(price: number): string {
    if (!Number.isFinite(price) || price === 0) return '0.00';
    const decimals = price >= 1 ? 2 : price >= 0.01 ? 4 : 6;
    return price.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

interface MarketsTabProps {
  onSwapClick: (asset?: string) => void;
}

const MarketsTab: React.FC<MarketsTabProps> = ({ onSwapClick }) => {
  const deployedSymbols = FLUX_ASSETS.filter(a => a.deployed).map(a => a.symbol);
  const { prices: realPrices, loading: pricesLoading } = useMultiplePriceFeeds(deployedSymbols);

  const G = {
    card: { background: 'rgba(13,13,18,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' },
    green: 'var(--green-300)',
    dim: 'var(--text-dim)',
    secondary: 'var(--text-secondary)',
    th: {
      padding: '14px 20px', textAlign: 'left' as const,
      fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)',
      textTransform: 'uppercase' as const, letterSpacing: '0.08em',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
    } as React.CSSProperties,
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#F0F0F0', margin: '0 0 4px' }}>Markets</h2>
        <div style={{ fontSize: '0.75rem', color: G.dim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Live market data</div>
      </div>

      <div style={G.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={G.th}>Asset</th>
              <th style={{ ...G.th, textAlign: 'right' }}>Price</th>
              <th style={{ ...G.th, textAlign: 'right' }}>24h change</th>
              <th style={{ ...G.th, textAlign: 'right' }}>24h volume</th>
              <th style={{ ...G.th, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {FLUX_ASSETS.map((asset, index) => {
              const marketData = MOCK_MARKETS.find(m => m.symbol === asset.symbol);
              const isPositive = (marketData?.change24h || 0) >= 0;

              return (
                <motion.tr
                  key={asset.symbol}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F0F0F0', marginBottom: 2 }}>{asset.symbol}</div>
                    <div style={{ fontSize: '0.77rem', color: G.dim }}>{asset.name}</div>
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'right', fontWeight: 600, color: '#F0F0F0' }}>
                    {pricesLoading ? (
                      <span style={{ color: G.dim }}>...</span>
                    ) : realPrices[asset.symbol] ? (
                      <span>
                        ${realPrices[asset.symbol].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span style={{ fontSize: '0.6rem', color: 'var(--green-400)', marginLeft: 5 }}>●</span>
                      </span>
                    ) : (
                      <span>${formatPrice(marketData?.price ?? 0)}</span>
                    )}
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                      background: isPositive ? 'rgba(61,158,78,0.1)' : 'rgba(255,85,119,0.1)',
                      color: isPositive ? 'var(--green-400)' : '#FF5577',
                      border: `1px solid ${isPositive ? 'rgba(61,158,78,0.2)' : 'rgba(255,85,119,0.2)'}`,
                    }}>
                      {isPositive ? '+' : ''}{marketData?.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'right', color: G.secondary, fontSize: '0.88rem' }}>
                    ${marketData?.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'center' }}>
                    <button
                      onClick={() => onSwapClick(asset.symbol)}
                      style={{
                        background: 'rgba(61,158,78,0.08)', border: '1px solid var(--green-700)',
                        color: 'var(--green-300)', padding: '7px 18px', borderRadius: 8,
                        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s', letterSpacing: '0.04em',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(61,158,78,0.18)'; e.currentTarget.style.borderColor = 'var(--green-500)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(61,158,78,0.08)'; e.currentTarget.style.borderColor = 'var(--green-700)'; }}
                    >
                      Swap
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: 20, padding: '14px 20px',
        background: 'rgba(13,13,18,0.7)', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, fontSize: '0.78rem', color: G.dim, textAlign: 'center',
      }}>
        Indicative prices on Arc Testnet. Spot rates execute against ObscuraAMM (USDC-quoted).
        <span style={{ color: 'var(--green-400)', marginLeft: 6 }}>●</span>
      </div>
    </div>
  );
};

export default MarketsTab;
