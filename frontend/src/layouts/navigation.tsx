import type { ReactNode } from 'react';
import type { Role } from '@shared/constants';

export interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  badgeKey?: 'notifications' | 'verifications' | 'redemptions' | 'risk';
  end?: boolean;
}

export interface NavSection { title?: string; items: NavEntry[] }

const ic = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const icons = {
  dashboard: ic('M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z'),
  network: ic('M12 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM19 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 9v3M6.5 15 12 12l5.5 3'),
  campaigns: ic('M3 11v3a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8'),
  submit: ic('M12 5v14M5 12h14'),
  submissions: ic('M9 5h6a2 2 0 0 1 2 2v12l-5-3-5 3V7a2 2 0 0 1 2-2z'),
  wallet: ic('M3 8a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 8v9a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 8h16M17 13h4v3h-4a1.5 1.5 0 0 1 0-3z'),
  rewards: ic('M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2'),
  redemptions: ic('M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V8zM12 8v10'),
  analytics: ic('M4 20V10M10 20V4M16 20v-7M22 20H2'),
  leaderboard: ic('M8 20V12M12 20V6M16 20v-5M4 20h16'),
  settings: ic('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.8 2 2 0 1 1 3 9.8a1.6 1.6 0 0 0 1.8-.3 2 2 0 1 1 2.8-2.8 1.6 1.6 0 0 0 1.8.3H10a2 2 0 1 1 4 0 1.6 1.6 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.6 1.6 0 0 0-.3 1.8V13a2 2 0 1 1 0 4z'),
  support: ic('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01'),
  notifications: ic('M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0'),
  users: ic('M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8'),
  verify: ic('M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z'),
  risk: ic('M12 3 2 20h20L12 3zM12 10v4M12 17h.01'),
  audit: ic('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 14h6M9 17h4'),
  reports: ic('M4 20V10M10 20V4M16 20v-7M22 20H2'),
  vouchers: ic('M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V8z'),
  liability: ic('M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5'),
  institutions: ic('M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6'),
  economics: ic('M3 17l6-6 4 4 8-8M21 7v5h-5'),
  admins: ic('M12 3l8 4v5c0 4.5-3.2 8.6-8 10-4.8-1.4-8-5.5-8-10V7l8-4zM9 12l2 2 4-4'),
  more: ic('M5 12h.01M12 12h.01M19 12h.01'),
};

export const ambassadorNav: NavSection[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: icons.dashboard, end: true },
      { to: '/network', label: 'Network', icon: icons.network },
      { to: '/campaigns', label: 'Campaigns', icon: icons.campaigns },
      { to: '/submit-post', label: 'Submit Post', icon: icons.submit },
      { to: '/my-submissions', label: 'My Submissions', icon: icons.submissions },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { to: '/wallet', label: 'Wallet', icon: icons.wallet },
      { to: '/rewards', label: 'Rewards Shop', icon: icons.rewards },
      { to: '/my-redemptions', label: 'My Redemptions', icon: icons.redemptions },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: icons.analytics },
      { to: '/leaderboard', label: 'Leaderboard', icon: icons.leaderboard },
      { to: '/notifications', label: 'Notifications', icon: icons.notifications, badgeKey: 'notifications' },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    items: [
      { to: '/admin', label: 'Dashboard', icon: icons.dashboard, end: true },
      { to: '/admin/verifications', label: 'Verifications', icon: icons.verify, badgeKey: 'verifications' },
      { to: '/admin/redemptions', label: 'Redemptions', icon: icons.redemptions, badgeKey: 'redemptions' },
      { to: '/admin/users', label: 'Users', icon: icons.users },
      { to: '/admin/campaigns', label: 'Campaigns', icon: icons.campaigns },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/admin/flags', label: 'Risk Flags', icon: icons.risk, badgeKey: 'risk' },
      { to: '/admin/support', label: 'Support Inbox', icon: icons.support },
      { to: '/admin/reports', label: 'Reports', icon: icons.reports },
      { to: '/admin/notifications', label: 'Announcements', icon: icons.notifications },
    ],
  },
];

export const superAdminNav: NavSection[] = [
  {
    items: [
      { to: '/super-admin', label: 'Platform Overview', icon: icons.dashboard, end: true },
      { to: '/super-admin/liability', label: 'Liability', icon: icons.liability },
      { to: '/super-admin/admins', label: 'Administrators', icon: icons.admins },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/super-admin/settings/economics', label: 'Economics', icon: icons.economics },
      { to: '/super-admin/settings/general', label: 'General Settings', icon: icons.settings },
      { to: '/super-admin/vouchers', label: 'Voucher Inventory', icon: icons.vouchers },
      { to: '/super-admin/institutions', label: 'Institutions', icon: icons.institutions },
    ],
  },
  {
    title: 'Governance',
    items: [
      { to: '/super-admin/audit', label: 'Audit Log', icon: icons.audit },
      { to: '/super-admin/risk', label: 'Fraud & Risk', icon: icons.risk, badgeKey: 'risk' },
    ],
  },
];

/** Staff can always drop back into the ambassador experience. */
export function navigationFor(role: Role): NavSection[] {
  if (role === 'SUPER_ADMIN') {
    return [
      ...superAdminNav,
      { title: 'Operations', items: adminNav.flatMap((s) => s.items).slice(1) },
    ];
  }
  if (role === 'ADMIN') return adminNav;
  return ambassadorNav;
}

export const mobilePrimaryNav: NavEntry[] = [
  { to: '/dashboard', label: 'Home', icon: icons.dashboard, end: true },
  { to: '/submit-post', label: 'Submit', icon: icons.submit },
  { to: '/rewards', label: 'Rewards', icon: icons.rewards },
  { to: '/network', label: 'Network', icon: icons.network },
];

export const mobileMoreNav: NavEntry[] = [
  { to: '/campaigns', label: 'Campaigns', icon: icons.campaigns },
  { to: '/wallet', label: 'Wallet', icon: icons.wallet },
  { to: '/my-submissions', label: 'My Submissions', icon: icons.submissions },
  { to: '/my-redemptions', label: 'My Redemptions', icon: icons.redemptions },
  { to: '/analytics', label: 'Analytics', icon: icons.analytics },
  { to: '/leaderboard', label: 'Leaderboard', icon: icons.leaderboard },
  { to: '/notifications', label: 'Notifications', icon: icons.notifications, badgeKey: 'notifications' },
  { to: '/settings', label: 'Settings', icon: icons.settings },
  { to: '/support', label: 'Support', icon: icons.support },
];
