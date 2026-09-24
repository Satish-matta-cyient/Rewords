import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { RequireAuth, RequireRole, RedirectIfAuthenticated, HomeRedirect } from './guards';
import { RootErrorBoundary } from './RootErrorBoundary';

// Every page is lazily loaded so the initial bundle stays small.
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const SignupPage = lazy(() => import('@/features/auth/pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const NetworkPage = lazy(() => import('@/features/referrals/NetworkPage'));
const CampaignsPage = lazy(() => import('@/features/campaigns/CampaignsPage'));
const CampaignDetailPage = lazy(() => import('@/features/campaigns/CampaignDetailPage'));
const SubmitPostPage = lazy(() => import('@/features/submissions/SubmitPostPage'));
const MySubmissionsPage = lazy(() => import('@/features/submissions/MySubmissionsPage'));
const SubmissionDetailPage = lazy(() => import('@/features/submissions/SubmissionDetailPage'));
const WalletPage = lazy(() => import('@/features/wallet/WalletPage'));
const RewardsPage = lazy(() => import('@/features/rewards/RewardsPage'));
const RewardDetailPage = lazy(() => import('@/features/rewards/RewardDetailPage'));
const MyRedemptionsPage = lazy(() => import('@/features/redemptions/MyRedemptionsPage'));
const RedemptionDetailPage = lazy(() => import('@/features/redemptions/RedemptionDetailPage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const LeaderboardPage = lazy(() => import('@/features/gamification/LeaderboardPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const SupportPage = lazy(() => import('@/features/support/SupportPage'));
const TicketDetailPage = lazy(() => import('@/features/support/TicketDetailPage'));

const AdminDashboardPage = lazy(() => import('@/features/admin/AdminDashboardPage'));
const VerificationQueuePage = lazy(() => import('@/features/verification/VerificationQueuePage'));
const AdminRedemptionsPage = lazy(() => import('@/features/redemptions/AdminRedemptionsPage'));
const AdminUsersPage = lazy(() => import('@/features/users/AdminUsersPage'));
const UserDetailPage = lazy(() => import('@/features/users/UserDetailPage'));
const AdminCampaignsPage = lazy(() => import('@/features/campaigns/AdminCampaignsPage'));
const CampaignFormPage = lazy(() => import('@/features/campaigns/CampaignFormPage'));
const RiskQueuePage = lazy(() => import('@/features/risk/RiskQueuePage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const SupportInboxPage = lazy(() => import('@/features/support/SupportInboxPage'));
const AnnouncementsPage = lazy(() => import('@/features/notifications/AnnouncementsPage'));

const SuperAdminDashboardPage = lazy(() => import('@/features/admin/SuperAdminDashboardPage'));
const AdminsPage = lazy(() => import('@/features/users/AdminsPage'));
const EconomicsPage = lazy(() => import('@/features/settings/EconomicsPage'));
const GeneralSettingsPage = lazy(() => import('@/features/settings/GeneralSettingsPage'));
const VouchersPage = lazy(() => import('@/features/vouchers/VouchersPage'));
const VoucherDetailPage = lazy(() => import('@/features/vouchers/VoucherDetailPage'));
const LiabilityPage = lazy(() => import('@/features/admin/LiabilityPage'));
const AuditPage = lazy(() => import('@/features/audit/AuditPage'));
const InstitutionsPage = lazy(() => import('@/features/institutions/InstitutionsPage'));

const TermsPage = lazy(() => import('@/features/legal/TermsPage'));
const PrivacyPage = lazy(() => import('@/features/legal/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/features/legal/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/features/legal/ForbiddenPage'));

export const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    children: [
      { path: '/', element: <HomeRedirect /> },

      // Public
      {
        element: <RedirectIfAuthenticated />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/signup', element: <SignupPage /> },
              { path: '/forgot-password', element: <ForgotPasswordPage /> },
              { path: '/reset-password', element: <ResetPasswordPage /> },
            ],
          },
        ],
      },
      { path: '/verify-email', element: <AuthLayout />, children: [{ index: true, element: <VerifyEmailPage /> }] },
      { path: '/terms', element: <TermsPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/403', element: <ForbiddenPage /> },
      { path: '/404', element: <NotFoundPage /> },

      // Authenticated
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          {
            element: <AppLayout />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/network', element: <NetworkPage /> },
              { path: '/network/:userId', element: <NetworkPage /> },
              { path: '/campaigns', element: <CampaignsPage /> },
              { path: '/campaigns/:id', element: <CampaignDetailPage /> },
              { path: '/submit-post', element: <SubmitPostPage /> },
              { path: '/my-submissions', element: <MySubmissionsPage /> },
              { path: '/my-submissions/:id', element: <SubmissionDetailPage /> },
              { path: '/wallet', element: <WalletPage /> },
              { path: '/rewards', element: <RewardsPage /> },
              { path: '/rewards/:id', element: <RewardDetailPage /> },
              { path: '/my-redemptions', element: <MyRedemptionsPage /> },
              { path: '/my-redemptions/:id', element: <RedemptionDetailPage /> },
              { path: '/analytics', element: <AnalyticsPage /> },
              { path: '/leaderboard', element: <LeaderboardPage /> },
              { path: '/notifications', element: <NotificationsPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/support', element: <SupportPage /> },
              { path: '/support/:id', element: <TicketDetailPage /> },

              // Admin
              {
                element: <RequireRole minimum="ADMIN" />,
                children: [
                  { path: '/admin', element: <AdminDashboardPage /> },
                  { path: '/admin/verifications', element: <VerificationQueuePage /> },
                  { path: '/admin/verifications/:id', element: <VerificationQueuePage /> },
                  { path: '/admin/redemptions', element: <AdminRedemptionsPage /> },
                  { path: '/admin/redemptions/:id', element: <AdminRedemptionsPage /> },
                  { path: '/admin/users', element: <AdminUsersPage /> },
                  { path: '/admin/users/:id', element: <UserDetailPage /> },
                  { path: '/admin/campaigns', element: <AdminCampaignsPage /> },
                  { path: '/admin/campaigns/new', element: <CampaignFormPage /> },
                  { path: '/admin/campaigns/:id', element: <CampaignFormPage /> },
                  { path: '/admin/flags', element: <RiskQueuePage /> },
                  { path: '/admin/reports', element: <ReportsPage /> },
                  { path: '/admin/support', element: <SupportInboxPage /> },
                  { path: '/admin/support/:id', element: <TicketDetailPage /> },
                  { path: '/admin/notifications', element: <AnnouncementsPage /> },
                ],
              },

              // Super Admin
              {
                element: <RequireRole minimum="SUPER_ADMIN" />,
                children: [
                  { path: '/super-admin', element: <SuperAdminDashboardPage /> },
                  { path: '/super-admin/admins', element: <AdminsPage /> },
                  { path: '/super-admin/admins/new', element: <AdminsPage /> },
                  { path: '/super-admin/settings/economics', element: <EconomicsPage /> },
                  { path: '/super-admin/settings/general', element: <GeneralSettingsPage /> },
                  { path: '/super-admin/vouchers', element: <VouchersPage /> },
                  { path: '/super-admin/vouchers/:id', element: <VoucherDetailPage /> },
                  { path: '/super-admin/vouchers/:id/codes', element: <VoucherDetailPage /> },
                  { path: '/super-admin/liability', element: <LiabilityPage /> },
                  { path: '/super-admin/audit', element: <AuditPage /> },
                  { path: '/super-admin/risk', element: <RiskQueuePage /> },
                  { path: '/super-admin/institutions', element: <InstitutionsPage /> },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },
]);
