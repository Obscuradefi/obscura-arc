import React from 'react';

/**
 * Token icon component. Renders a PNG from /public/assets/<symbol>.png when
 * available; falls back to a colored circle with the first letter of the
 * symbol when the image fails to load (or asset not present).
 *
 * Centralizes display so swapping icons later only touches one place.
 */

interface TokenIconProps {
    symbol: string;
    size?: number;
    style?: React.CSSProperties;
}

// Map symbol to image filename. JPYC uses the JPY icon, EURC uses EUR.
const ICON_MAP: Record<string, string> = {
    USDC: '/assets/usdc.png',
    EURC: '/assets/eur.png',
    JPYC: '/assets/jpy.png',
    GOLD: '/assets/gold.png',
    AAPL: '/assets/aapl.png',
    MSTR: '/assets/mstr.png',
};

const FALLBACK_COLORS: Record<string, string> = {
    USDC: '#2775CA',
    EURC: '#1976D2',
    JPYC: '#E91E63',
    GOLD: '#F2A900',
    AAPL: '#8E8E93',
    MSTR: '#000000',
};

const TokenIcon: React.FC<TokenIconProps> = ({ symbol, size = 32, style }) => {
    const [errored, setErrored] = React.useState(false);
    const src = ICON_MAP[symbol];
    const fallbackColor = FALLBACK_COLORS[symbol] || '#666';

    if (!src || errored) {
        return (
            <div
                style={{
                    width: size,
                    height: size,
                    background: fallbackColor,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: size * 0.42,
                    color: 'white',
                    flexShrink: 0,
                    ...style,
                }}
            >
                {symbol.charAt(0)}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={symbol}
            width={size}
            height={size}
            onError={() => setErrored(true)}
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                ...style,
            }}
        />
    );
};

export default TokenIcon;
