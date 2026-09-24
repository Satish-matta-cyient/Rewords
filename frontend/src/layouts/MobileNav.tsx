import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { mobilePrimaryNav, mobileMoreNav, icons } from './navigation';
import { useBadgeCounts } from '@/hooks/useBadgeCounts';
import { useAuthStore } from '@/store/authStore';

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const badges = useBadgeCounts();
  const role = useAuthStore((s) => s.user?.role);

  // The bottom bar is an ambassador affordance; staff use the drawer.
  if (role !== 'USER') return null;

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {mobilePrimaryNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="bottom-nav__item">
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottom-nav__item" data-active={moreOpen} onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>
          {icons.more}
          <span>More</span>
          {badges.notifications ? <span className="notification-dot" style={{ top: 10, right: '30%' }} aria-hidden /> : null}
        </button>
      </nav>

      {moreOpen
        ? createPortal(
            <>
              <div className="overlay" onClick={() => setMoreOpen(false)} aria-hidden />
              <div className="more-sheet" role="dialog" aria-modal="true" aria-label="More navigation">
                <div className="more-sheet__grip" aria-hidden />
                {mobileMoreNav.map((item) => (
                  <NavLink key={item.to} to={item.to} className="nav-item" onClick={() => setMoreOpen(false)}>
                    <span className="nav-item__icon">{item.icon}</span>
                    <span className="grow">{item.label}</span>
                    {item.badgeKey && badges[item.badgeKey] ? <span className="nav-item__badge">{badges[item.badgeKey]}</span> : null}
                  </NavLink>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
