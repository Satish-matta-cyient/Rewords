import { describe, it, expect, beforeEach } from 'vitest';
import { Suspense, type ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from './index';
import { useAuthStore } from '@/store/authStore';

/**
 * Every page is lazy and most public routes sit under no layout, so the root
 * route carries the only Suspense boundary above them. Without it, a redirect
 * into a chunk that has not downloaded yet suspends on a synchronous update
 * and React tears the tree down into the error boundary (#426).
 *
 * jsdom does not reproduce that suspend — these render tests pass either way —
 * so the boundary itself is asserted structurally.
 */
function renderAt(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Lazy route boundaries', () => {
  beforeEach(() => { useAuthStore.setState({ user: null, status: 'anonymous' }); });

  it('keeps a Suspense boundary above every route', () => {
    expect((routes[0].element as ReactElement).type).toBe(Suspense);
  });

  it('renders the lazy sign-in page inside the auth layout', async () => {
    renderAt('/login');
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  });

  it('renders a lazy public page that no layout wraps', async () => {
    renderAt('/404');
    expect(await screen.findByRole('heading')).toBeInTheDocument();
  });
});
