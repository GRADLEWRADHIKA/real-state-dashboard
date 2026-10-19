import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { configureSite } from '@estateflow/site';
import { AuthProvider } from '@/lib/auth';
import { ConfirmProvider } from '@/components/ui/Modal';
import { RealtimeSync } from '@/lib/realtime';
import { serverUrl } from '@/lib/api';
import App from './App';
import './index.css';

configureSite({ apiUrl: serverUrl, appDownloadUrl: window.ESTATEFLOW_CONFIG?.appDownloadUrl });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: (count, err: any) => err?.status !== 401 && err?.status !== 403 && err?.status !== 404 && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <RealtimeSync />
          <TooltipProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="top-right"
        offset={{ top: 72 }}
        mobileOffset={{ top: 64 }}
        toastOptions={{
          classNames: {
            toast: '!rounded-xl !border-stone-200 !shadow-pop !font-sans',
            title: '!font-semibold',
          },
        }}
        richColors
        closeButton
      />
    </QueryClientProvider>
  </StrictMode>,
);
