import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoutes from './AppRoutes';
import './styles/global.css';
import '@rainbow-me/rainbowkit/styles.css';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { PrivyProvider } from '@privy-io/react-auth';
import { config } from './wagmi';
import { CircleWalletProvider } from './hooks/useCircleWallet';
import { PRIVY_APP_ID, PRIVY_CONFIG, isPrivyConfigured } from './config/privyConfig';

const queryClient = new QueryClient();

const customTheme = darkTheme({
  accentColor: '#3D9E4E',
  accentColorForeground: '#FFFFFF',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

// Wrap the app with a Privy provider only when an app ID is configured.
// Without it, PrivyProvider would log noisy errors and the login button
// hides itself anyway.
const WithPrivy = ({ children }) =>
  isPrivyConfigured() ? (
    <PrivyProvider appId={PRIVY_APP_ID} config={PRIVY_CONFIG}>
      {children}
    </PrivyProvider>
  ) : (
    <>{children}</>
  );

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WithPrivy>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={customTheme} modalSize="wide">
            <CircleWalletProvider>
              <AppRoutes />
            </CircleWalletProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </WithPrivy>
  </React.StrictMode>
);
