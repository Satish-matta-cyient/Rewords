import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/tests/utils';
import { RequireAuth, RequireRole } from './guards';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@shared/types';

function makeUser(role: AuthUser['role']): AuthUser {
  return {
    id: 'u1', email: 'test@edurewards.local', fullName: 'Test User', role,
    status: 'ACTIVE', emailVerified: true, onboardingStep: 3, referralCode: 'ABC123', institutionId: null,
  };
}

function tree() {
  return (
    <Routes>
      <Route path="/login" element={<div>Sign in</div>} />
      <Route path="/403" element={<div>Forbidden</div>} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route element={<RequireRole minimum="ADMIN" />}>
          <Route path="/admin" element={<div>Admin console</div>} />
        </Route>
        <Route element={<RequireRole minimum="SUPER_ADMIN" />}>
          <Route path="/super-admin" element={<div>Platform console</div>} />
        </Route>
      </Route>
    </Routes>
  );
}

describe('Route guards', () => {
  beforeEach(() => { useAuthStore.setState({ user: null, status: 'anonymous' }); });

  it('sends anonymous visitors to the sign-in page', () => {
    renderWithProviders(tree(), { route: '/dashboard' });
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('lets an authenticated ambassador reach their dashboard', () => {
    useAuthStore.setState({ user: makeUser('USER'), status: 'authenticated' });
    renderWithProviders(tree(), { route: '/dashboard' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('sends an ambassador to 403 rather than login for admin routes', () => {
    useAuthStore.setState({ user: makeUser('USER'), status: 'authenticated' });
    renderWithProviders(tree(), { route: '/admin' });
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });

  it('allows an admin into the admin console', () => {
    useAuthStore.setState({ user: makeUser('ADMIN'), status: 'authenticated' });
    renderWithProviders(tree(), { route: '/admin' });
    expect(screen.getByText('Admin console')).toBeInTheDocument();
  });

  it('blocks an admin from super-admin-only routes', () => {
    useAuthStore.setState({ user: makeUser('ADMIN'), status: 'authenticated' });
    renderWithProviders(tree(), { route: '/super-admin' });
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });

  it('lets a super admin into every area, including admin routes', () => {
    useAuthStore.setState({ user: makeUser('SUPER_ADMIN'), status: 'authenticated' });
    const { rerender } = renderWithProviders(tree(), { route: '/super-admin' });
    expect(screen.getByText('Platform console')).toBeInTheDocument();
    rerender(tree());
  });
});
