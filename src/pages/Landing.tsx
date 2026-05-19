import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

function AnimatedCounter({ target, prefix = '', suffix = '', decimals = 0 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, target);
      setValue(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  const formatted = decimals > 0
    ? value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : Math.round(value).toLocaleString();

  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

const tickerItems = [
  { label: 'Shadow Layer online · 5 contracts deployed on Arc Testnet.', color: 'var(--green-400)' },
  { label: 'Maker pool fan-out: 3 quotes received in 280ms.', color: 'var(--green-300)' },
  { label: 'Pyth ceiling check passed: deviation 12bps.', color: 'var(--green-400)' },
  { label: 'Nanopay channel: agent paid $0.0035 across 4 services.', color: 'var(--green-300)' },
  { label: 'Conditional intent armed: GOLD < $4475 -> auto-execute.', color: 'var(--green-400)' },
  { label: 'Shadow vault: 1.2 USDC deposited at HIGH privacy.', color: 'var(--green-300)' },
  { label: 'Multi-agent orchestration: Researcher → Executor → Verifier.', color: 'var(--green-400)' },
  { label: 'x402 micropayment: 0.001 USDC per oracle call.', color: 'var(--green-300)' },
  { label: 'Settled on Arc: sub-second finality, 0.30% pool fee.', color: 'var(--green-400)' },
];

function LiveTicker() {
  const doubled = [...tickerItems, ...tickerItems];
  return (
    <div className="activity-ticker">
      <div className="activity-ticker-inner">
        {doubled.map((item, i) => (
          <div key={i} className="activity-ticker-item">
            <div className="activity-ticker-dot" style={{ background: item.color }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.77rem' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div
      className="dashboard-card"
      style={{ animation: 'float-card 6s ease-in-out infinite', width: '100%' }}
    >
      <div style={{ display: 'flex', height: 360 }}>
        {}
        <div className="dashboard-sidebar">
          <div style={{ padding: '0 18px 16px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/assets/2.png" alt="Obscura Logo" style={{ height: '14px', width: 'auto', objectFit: 'contain' }} />
              <span style={{ fontFamily: "'MADE Future X Header', sans-serif", fontSize: '0.65rem', color: 'var(--green-400)', letterSpacing: '0.5px' }}>OBSCURA</span>
            </div>
          </div>
          {[
            { label: 'Portfolio', active: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            { label: 'Swap', active: false, icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
            { label: 'Vault', active: false, icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
            { label: 'Markets', active: false, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { label: 'Liquidity', active: false, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
          ].map((item) => (
            <div key={item.label} className={`sidebar-item${item.active ? ' active' : ''}`}>
              <svg className="sidebar-icon" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span style={{ fontSize: '0.78rem' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {}
        <div style={{ flex: 1, padding: 22, overflow: 'hidden' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Total Balance
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-main)' }}>
                $345,340.56
              </span>
              <span className="badge-green" style={{ marginBottom: 4, fontSize: '0.68rem' }}>+11.2% All Time</span>
            </div>
          </div>

          {}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'USDC', value: '$25,600' },
              { label: 'GOLD', value: '$35,200' },
              { label: 'Private', value: '$24,300' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {}
          <div style={{ height: 72, position: 'relative', marginBottom: 14 }}>
            <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 72">
              <defs>
                <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,72 L0,55 Q40,48 80,38 T160,42 T240,22 T320,32 Q360,14 400,8 L400,72 Z"
                fill="url(#hero-grad)"
              />
              <path
                d="M0,55 Q40,48 80,38 T160,42 T240,22 T320,32 Q360,14 400,8"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(61,158,78,0.5))' }}
              />
            </svg>
          </div>

          {}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(61,158,78,0.06)', border: '1px solid rgba(61,158,78,0.15)', borderRadius: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-light)', boxShadow: '0 0 6px var(--accent-light)', animation: 'pulse-dot 2s infinite', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--green-300)' }}>Privacy shield active. All transactions encrypted.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const goToApp = () => navigate('/app');

  return (
    <div style={{ position: 'relative' }}>
      <Navbar />

      {}
      <div className="site-wrapper">

        {}
        <section className="hero-section">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              <div className="hero-badge">
                <div className="hero-badge-dot" />
                <span className="hero-badge-text">The Shadow Layer · Arc by Circle</span>
              </div>

              <h1 className="hero-title">
                The Shadow<br />
                <span>Layer</span>
              </h1>

              <p className="hero-subtitle">
                Privacy infrastructure for the agentic economy. Obscura lets autonomous agents discover, negotiate, and settle stablecoin trades on Arc behind opaque commitments, oracle-bounded RFQ, and sub-cent USDC nanopayments.
              </p>

              <div className="hero-cta-row">
                <button
                  className="btn-primary"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ fontSize: '0.7rem' }}
                >
                  Explore features
                </button>
              </div>

              {}
              <div style={{ display: 'flex', gap: 28, marginTop: 44 }}>
                {[
                  { label: 'Stablecoins', value: 3 },
                  { label: 'Maker Pool', value: 3 },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-main)' }}>
                      <AnimatedCounter target={value} />
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--green-300)' }}>Live</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arc Testnet</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            >
              <DashboardMockup />
            </motion.div>
          </div>
        </section>

        {}
        <LiveTicker />

        {}
        <section id="features" style={{ padding: '90px 40px' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-label green">Core capabilities</div>
            <h2 className="section-title" style={{ maxWidth: 580 }}>
              Clarity and control for every part of your portfolio
            </h2>
            <p className="section-desc" style={{ marginBottom: 56 }}>
              A clear, structured view of your capital. From asset allocation to performance insights and privacy controls.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                num: '01',
                title: 'Total asset visibility',
                desc: 'Understand your positions. Clearly structured in one unified system. Get a complete view of your portfolio across all assets.',
                preview: (
                  <div style={{ background: 'rgba(13,13,18,0.8)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Portfolio Overview</div>
                    {['USDC', 'GOLD', 'AAPL', 'cUSDC'].map((sym, i) => (
                      <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 3 ? '1px solid var(--glass-border-light)' : 'none' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>{sym}</span>
                        <span className="badge-green" style={{ fontSize: '0.62rem' }}>+{(Math.random() * 5 + 0.5).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                num: '02',
                title: 'Precision performance tracking',
                desc: 'Advanced analytics to monitor growth, routing efficiency, and privacy impact. Analyze performance with deeper insights.',
                preview: (
                  <div style={{ background: 'rgba(13,13,18,0.8)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last 7 Days</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--green-300)', marginBottom: 12 }}>27.4%</div>
                    {[
                      { label: 'Privacy impact', val: 'Encrypted', color: 'var(--green-400)' },
                      { label: 'Routing efficiency', val: '+8.2%', color: 'var(--green-300)' },
                      { label: 'Slippage saved', val: '2.1%', color: 'var(--green-400)' },
                    ].map((r) => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-dim)' }}>{r.label}</span>
                        <span style={{ color: r.color, fontWeight: 600 }}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                num: '03',
                title: 'Global allocation intelligence',
                desc: 'Realtime asset class distribution and opportunity mapping. Track flows and emerging opportunities in one structured view.',
                preview: (
                  <div style={{ background: 'rgba(13,13,18,0.8)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Capital Allocated</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-main)', marginBottom: 10 }}>$52,473,178</div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                      {[60, 25, 15].map((w, i) => (
                        <div key={i} style={{ height: 4, flex: w, borderRadius: 2, background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--green-600)' : 'var(--green-800)' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['Stablecoin', 'Commodity', 'Equity'].map((l, i) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--green-600)' : 'var(--green-800)' }} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
            ].map((feat, idx) => (
              <motion.div
                key={feat.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                <div>
                  <div className="feature-number">{feat.num}</div>
                  <div className="feature-title">{feat.title}</div>
                  <div className="feature-desc">{feat.desc}</div>
                </div>
                {feat.preview}
              </motion.div>
            ))}
          </div>
        </section>

        {}
        <section style={{ padding: '0 40px 90px' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="signal-card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
                <div>
                  <div className="section-label green" style={{ marginBottom: 16 }}>AI Intelligence</div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.035em', color: 'var(--text-main)', marginBottom: 14, lineHeight: 1.15 }}>
                    Privacy intelligence. Powered by AI.
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--green-200)', lineHeight: 1.7, marginBottom: 24, opacity: 0.8 }}>
                    The Obscura AI agent monitors market conditions, routes trades through the optimal path, and manages your vault exposure in complete privacy.
                  </p>
                  <button className="nav-launch-btn" onClick={goToApp} style={{ fontSize: '0.85rem' }}>
                    Try AI trading
                  </button>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <div className="signal-strength-ring">
                      <span className="signal-strength-inner">87</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--green-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Signal strength</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>High confidence routing</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--green-300)', marginTop: 2 }}>Rebalance recommended</div>
                    </div>
                  </div>

                  {[
                    { badge: 'alert', text: 'Volatility detected in emerging markets. Reducing exposure recommended.', type: 'warning' },
                    { badge: 'info', text: 'AI routing applied. RFQ path selected, saving 1.8% on last swap.', type: 'info' },
                    { badge: 'info', text: 'Vault rebalance complete. Privacy shield refreshed.', type: 'info' },
                  ].map((item, i) => (
                    <div key={i} className="signal-alert">
                      <span className={`signal-alert-badge ${item.type}`}>{item.badge}</span>
                      <span className="signal-alert-text">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {}
        <section style={{ padding: '0 40px 90px' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: 52 }}
          >
            <div className="section-label" style={{ marginBottom: 12 }}>Core capabilities</div>
            <h2 className="section-title">Powering every layer<br />of your privacy stack</h2>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {['AMM Engine', 'RFQ Network', 'AI Routing'].map((node, i) => (
              <motion.div
                key={node}
                className="arch-node"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <span className="arch-node-label">{node}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="arch-center-pill"
            style={{ textAlign: 'center', marginBottom: 16 }}
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div style={{ fontSize: '0.68rem', color: 'var(--green-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Obscura Core</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Unified privacy layer</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--green-300)', marginTop: 4 }}>AI powered orchestration. Central intelligence layer.</div>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {['Encrypted Vaults', 'Dark Pool Liquidity', 'Shield Protocol'].map((node, i) => (
              <motion.div
                key={node}
                className="arch-node"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <span className="arch-node-label">{node}</span>
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 40 }}>
            {[
              { title: 'Unified capital system', desc: 'All in one execution protocol connecting AMM pools, RFQ makers, and encrypted vaults in a single interface.' },
              { title: 'Cross market intelligence', desc: 'Analysis and capital routing across privacy pools, public markets, and dark liquidity. All in one system.' },
              { title: 'Seamless execution', desc: 'Smart routing finds the best path across every connected environment with zero slippage and MEV protection.' },
            ].map((cap, i) => (
              <motion.div
                key={cap.title}
                className="obscura-card"
                style={{ padding: '24px 22px' }}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--green-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{cap.title}</div>
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{cap.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {}
        <section style={{ padding: '0 40px 90px', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ marginBottom: 48 }}
          >
            <div className="section-label" style={{ marginBottom: 10 }}>Integrations</div>
            <h2 className="section-title">Seamlessly connected<br />to your DeFi ecosystem</h2>
            <p className="section-desc" style={{ margin: '14px auto 0', textAlign: 'center' }}>
              Realtime sync. Zero fragmentation. Connect your wallet, onchain assets, and liquidity positions. All synchronized in one system.
            </p>
          </motion.div>

          {}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
            {[
              { name: 'Arc by Circle', color: '#5FBFFF' },
              { name: 'USDC (native)', color: '#2775CA' },
              { name: 'CCTP v2', color: '#0091FF' },
              { name: 'RainbowKit', color: '#7B68EE' },
              { name: 'Wagmi', color: '#4B9BFF' },
              { name: 'Viem', color: '#FCA5A5' },
              { name: 'WalletConnect', color: '#3B99FC' },
              { name: 'Hardhat', color: 'var(--green-400)' },
            ].map((p) => (
              <motion.div
                key={p.name}
                className="integration-badge"
                whileHover={{ scale: 1.04 }}
              >
                <div className="integration-dot" style={{ background: p.color }} />
                <span>{p.name}</span>
              </motion.div>
            ))}
          </div>

          <div
            className="arch-center-pill"
            style={{ display: 'inline-block', padding: '10px 28px' }}
          >
            <span style={{ fontSize: '0.82rem', color: 'var(--green-200)', fontWeight: 600 }}>
              Core. Best in class DeFi composability.
            </span>
          </div>
        </section>

        {}
        <section className="comparison-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 52 }}
          >
            <div className="section-label" style={{ marginBottom: 10 }}>Why Obscura</div>
            <h2 className="section-title">Built for privacy.<br />Not legacy systems.</h2>
            <p className="section-desc" style={{ margin: '14px auto 0', textAlign: 'center' }}>
              Connect your assets, data, and execution into one intelligent private system. Clarity, speed, and control at every layer.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ background: 'rgba(10,10,14,0.8)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}
          >
            <table className="comparison-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Core capabilities</th>
                  <th style={{ textAlign: 'center' }}>Trad. DEX</th>
                  <th style={{ textAlign: 'center' }}>CEX</th>
                  <th className="highlight">obscura</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feat: 'Onchain privacy', other: 'No', cex: 'KYC required', obs: 'Shield protocol' },
                  { feat: 'Hybrid AMM and RFQ routing', other: 'AMM only', cex: 'Orderbook', obs: 'Hybrid routing' },
                  { feat: 'AI trade agent', other: 'No', cex: 'No', obs: 'Natural language' },
                  { feat: 'Encrypted vaults', other: 'No', cex: 'No', obs: 'REX encryption' },
                  { feat: 'Self custody', other: 'Partial', cex: 'No', obs: 'Full custody' },
                  { feat: 'MEV protection', other: 'No', cex: 'N/A', obs: 'RFQ atomic' },
                  { feat: 'Dark pool liquidity', other: 'No', cex: 'No', obs: 'Native' },
                  { feat: 'Total cost monthly', other: '$1,700+', cex: '$1,200+', obs: 'Open protocol' },
                ].map((row, i) => (
                  <tr key={row.feat}>
                    <td className="feature-name">{row.feat}</td>
                    <td className="other-platform"><span className="cross-icon">{row.other}</span></td>
                    <td className="other-platform"><span className="cross-icon">{row.cex}</span></td>
                    <td className="obscura-col"><span className="check-icon">{row.obs}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </section>

        {}
        <section className="cta-section">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-label" style={{ marginBottom: 16, textAlign: 'center' }}>Get started</div>
            <h2 className="section-title" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 18px' }}>
              Trade in complete privacy. Operate at a new level.
            </h2>
            <p className="section-desc" style={{ textAlign: 'center', margin: '0 auto 40px' }}>
              Obscura brings your assets, intelligence, and execution into one private system. Clarity and control across every layer.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={goToApp} style={{ fontSize: '0.9rem', paddingInline: 32 }}>
                Launch app
              </button>
              <a href="/docs" style={{ display: 'inline-block' }}>
                <button className="btn-secondary" style={{ fontSize: '0.9rem' }}>
                  Read docs
                </button>
              </a>
            </div>

            {}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 48 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)', animation: 'pulse-dot 1.5s infinite' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Live on Arc Testnet. Connect your wallet to start.
              </span>
            </div>
          </motion.div>
        </section>

        <Footer />
      </div>
    </div>
  );
};

export default Landing;
