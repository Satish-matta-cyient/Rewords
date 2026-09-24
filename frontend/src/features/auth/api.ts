import { api } from '@/api/client';
import type { AuthUser } from '@shared/types';

export interface LoginResponse { user: AuthUser; accessToken: string; expiresIn: string }
export interface RegisterResponse {
  user: AuthUser; referralCode: string; referralLink: string; verificationToken?: string;
}

export const authApi = {
  login: (body: { email: string; password: string }) => api.post<LoginResponse>('/auth/login', body),
  register: (body: Record<string, unknown>) => api.post<RegisterResponse>('/auth/register', body),
  logout: () => api.post<{ loggedOut: boolean }>('/auth/logout'),
  me: () => api.get<AuthUser>('/auth/me'),
  refresh: () => api.post<{ accessToken: string }>('/auth/refresh'),
  verifyEmail: (token: string) => api.post<{ verified: boolean }>('/auth/verify-email', { token }),
  resendVerification: () => api.post<{ sent: boolean; token?: string }>('/auth/resend-verification'),
  forgotPassword: (email: string) => api.post<{ sent: boolean; token?: string }>('/auth/forgot-password', { email }),
  resetPassword: (body: { token: string; password: string }) => api.post<{ reset: boolean }>('/auth/reset-password', body),
  changePassword: (body: { currentPassword: string; password: string }) => api.post<{ changed: boolean }>('/auth/change-password', body),
  resolveReferral: (code: string) => api.get<{ code: string; referrerName: string; valid: boolean }>(`/auth/referral/${code}`),
};
