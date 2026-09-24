import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { navigationFor, icons, type NavEntry } from './navigation';
import { Button } from '@/components/ui';
import { useBadgeCounts } from '@/hooks/useBadgeCounts';

function NavRow({ item, badge, onNavigate }: { item: NavEntry; badge?: number; onNavigate: () => void }) {
  return (
    <NavLink to={item.to} end={item.end} className="nav-item" onClick={onNavigate}>
      <span className="nav-item__icon">{item.icon}</span>
      <span className="grow">{item.label}</span>
      {badge ? <span className="nav-item__badge">{badge > 99 ? '99+' : badge}</span> : null}
    </NavLink>
  );
}

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const open = useUiStore((s) => s.sidebarOpen);
  const close = useUiStore((s) => s.closeSidebar);
  const badges = useBadgeCounts();
  const navigate = useNavigate();

  if (!user) return null;
  const sections = navigationFor(user.role);
  const isAmbassador = user.role === 'USER';

  return (
    <>
      {open ? <div className="overlay" onClick={close} aria-hidden style={{ zIndex: 69 }} /> : null}
      <aside className="sidebar" data-open={open} aria-label="Main navigation">
        <div className="sidebar__brand">
          <Link to="/" className="sidebar__logo">
            <span className="sidebar__mark" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17c0-5.5 4-10 11-10-1.5 6.5-5.5 9.5-11 10z" /><path d="M6 19c3.5-1.5 6-4 7.5-6.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
            </span>
            <span>
              <span className="sidebar__name">EduRewards</span>
              <span className="sidebar__tagline" style={{ display: 'block' }}>
                {user.role === 'SUPER_ADMIN' ? 'Platform Console' : user.role === 'ADMIN' ? 'Operations Console' : 'Ambassador Portal'}
              </span>
            </span>
          </Link>
        </div>

        {isAmbassador ? (
          <div className="sidebar__cta">
            <Button block icon={icons.submit} onClick={() => { close(); navigate('/submit-post'); }}>
              Submit a Post
            </Button>
          </div>
        ) : null}

        <nav className="sidebar__nav">
          {sections.map((section, index) => (
            <div key={section.title ?? index}>
              {section.title ? <div className="sidebar__section">{section.title}</div> : null}
              {section.items.map((item) => (
                <NavRow key={item.to} item={item} badge={item.badgeKey ? badges[item.badgeKey] : undefined} onNavigate={close} />
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <NavLink to="/settings" className="nav-item" onClick={close}>
            <span className="nav-item__icon">{icons.settings}</span> Settings
          </NavLink>
          <NavLink to="/support" className="nav-item" onClick={close}>
            <span className="nav-item__icon">{icons.support}</span> Support
          </NavLink>
        </div>
      </aside>
    </>
  );
}
