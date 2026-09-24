import { Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileBottomNav } from './MobileNav';
import { useUiStore } from '@/store/uiStore';
import { useIsTablet } from '@/hooks/useMediaQuery';
import { Skeleton } from '@/components/ui';
import './layout.css';

const TITLES: { match: RegExp; title: string; subtitle?: string }[] = [
  { match: /^\/dashboard/, title: 'Dashboard', subtitle: "Your ambassador performance at a glance" },
  { match: /^\/network/, title: 'My Network', subtitle: 'Your referral tree and level contributions' },
  { match: /^\/campaigns/, title: 'Campaigns', subtitle: 'Active campaigns you can promote' },
  { match: /^\/submit-post/, title: 'Submit a Post', subtitle: 'Share a live post link for verification' },
  { match: /^\/my-submissions/, title: 'My Submissions', subtitle: 'Track the status of every post you submitted' },
  { match: /^\/wallet/, title: 'Wallet', subtitle: 'Balances and your complete points ledger' },
  { match: /^\/rewards/, title: 'Rewards Shop', subtitle: 'Turn your points into vouchers and cash' },
  { match: /^\/my-redemptions/, title: 'My Redemptions', subtitle: 'Redemption history and voucher codes' },
  { match: /^\/analytics/, title: 'Analytics', subtitle: 'Referral and campaign performance' },
  { match: /^\/leaderboard/, title: 'Leaderboard', subtitle: 'How you rank this month' },
  { match: /^\/notifications/, title: 'Notifications' },
  { match: /^\/settings/, title: 'Settings' },
  { match: /^\/support/, title: 'Support' },
  { match: /^\/onboarding/, title: 'Get Started' },
  { match: /^\/admin\/verifications/, title: 'Verification Queue', subtitle: 'Review and decide submitted posts' },
  { match: /^\/admin\/redemptions/, title: 'Redemptions', subtitle: 'Approve requests and issue vouchers' },
  { match: /^\/admin\/users/, title: 'Users', subtitle: 'Accounts, points, activity and risk' },
  { match: /^\/admin\/campaigns/, title: 'Campaigns', subtitle: 'Create and manage campaigns' },
  { match: /^\/admin\/flags/, title: 'Risk Flags', subtitle: 'Fraud signals awaiting review' },
  { match: /^\/admin\/reports/, title: 'Reports', subtitle: 'Operational and financial exports' },
  { match: /^\/admin\/support/, title: 'Support Inbox' },
  { match: /^\/admin\/notifications/, title: 'Announcements' },
  { match: /^\/admin/, title: 'Operations Dashboard', subtitle: 'Monitor verification, redemptions and risk' },
  { match: /^\/super-admin\/settings\/economics/, title: 'Points Economics', subtitle: 'Referral ladder, conversion and limits' },
  { match: /^\/super-admin\/settings/, title: 'Platform Settings' },
  { match: /^\/super-admin\/vouchers/, title: 'Voucher Inventory', subtitle: 'Code pools, stock levels and batches' },
  { match: /^\/super-admin\/liability/, title: 'Liability', subtitle: 'Outstanding points and cash exposure' },
  { match: /^\/super-admin\/audit/, title: 'Audit Log', subtitle: 'Immutable record of every sensitive action' },
  { match: /^\/super-admin\/risk/, title: 'Fraud & Risk' },
  { match: /^\/super-admin\/admins/, title: 'Administrators' },
  { match: /^\/super-admin\/institutions/, title: 'Institutions' },
  { match: /^\/super-admin/, title: 'Platform Overview', subtitle: 'Growth, economics and platform health' },
];

function resolveTitle(pathname: string) {
  return TITLES.find((t) => t.match.test(pathname)) ?? { title: 'EduRewards', subtitle: undefined };
}

function OfflineBanner() {
  const online = useUiStore((s) => s.online);
  const setOnline = useUiStore((s) => s.setOnline);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [setOnline]);

  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      You are offline. Points, submissions and redemptions need a connection — changes will not be saved.
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const closeSidebar = useUiStore((s) => s.closeSidebar);
  const isTablet = useIsTablet();
  const { title, subtitle } = resolveTitle(location.pathname);

  // Close the drawer and restore scroll position on every navigation.
  useEffect(() => { closeSidebar(); window.scrollTo(0, 0); }, [location.pathname, closeSidebar]);
  useEffect(() => { document.title = `${title} · EduRewards`; }, [title]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <OfflineBanner />
        <Topbar title={title} subtitle={subtitle} />
        <main className="app-content" id="main-content">
          <Suspense fallback={<div className="stack"><Skeleton height={32} width="40%" /><Skeleton height={220} /></div>}>
            <Outlet />
          </Suspense>
        </main>
        {isTablet ? <MobileBottomNav /> : null}
      </div>
      <style>{`@media (max-width: 1024px) { .sidebar-toggle { display: inline-flex !important; } }`}</style>
    </div>
  );
}
