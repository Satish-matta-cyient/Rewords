import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { queryClient } from './api/queryClient';
import { Toaster } from './components/ui/Toaster';
import { SessionGate } from './app/SessionGate';
import './styles/global.css';
import './components/ui/ui.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionGate>
        <RouterProvider router={router} />
      </SessionGate>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
