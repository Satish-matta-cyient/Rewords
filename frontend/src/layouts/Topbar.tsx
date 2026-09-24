import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useLogout } from '@/features/auth/hooks';
import { useBadgeCounts } from '@/hooks/useBadgeCounts';
import { Avatar, IconButton } from '@/components/ui';
import { icons } from './navigation';

function ThemeToggle() {
  const theme = useUiStore((s) => s.resolvedTheme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <IconButton
      label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </IconButton>
  );
}

function ProfileMenu() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = useLogout();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        style={{ width: 36, height: 36 }}
      >
        <Avatar name={user.fullName} src={user.avatarUrl} size={32} />
      </button>

      {open ? (
        <div className="menu" role="menu">
          <div className="menu__header">
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user.fullName}</div>
            <div className="small muted truncate">{user.email}</div>
            <div className="small" style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
              {user.role === 'SUPER_ADMIN' ? 'Super Administrator' : user.role === 'ADMIN' ? 'Administrator' : 'Ambassador'}
            </div>
          </div>
          <Link to="/settings" className="menu__item" role="menuitem" onClick={() => setOpen(false)}>
            {icons.settings} Account settings
          </Link>
          {user.role !== 'USER' ? (
            <Link to="/dashboard" className="menu__item" role="menuitem" onClick={() => setOpen(false)}>
              {icons.dashboard} Ambassador view
            </Link>
          ) : null}
          <Link to="/support" className="menu__item" role="menuitem" onClick={() => setOpen(false)}>
            {icons.support} Help &amp; support
          </Link>
          <div className="menu__divider" />
          <button
            type="button"
            className="menu__item menu__item--danger"
            role="menuitem"
            onClick={() => { setOpen(false); logout.mutate(undefined, { onSuccess: () => navigate('/login') }); }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const badges = useBadgeCounts();

  return (
    <header className="topbar">
      <IconButton label="Open navigation" onClick={toggleSidebar} className="sidebar-toggle" style={{ display: 'none' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </IconButton>

      <div>
        <div className="topbar__title">{title}</div>
        {subtitle ? <div className="topbar__subtitle">{subtitle}</div> : null}
      </div>

      <div className="topbar__actions">
        <ThemeToggle />
        <Link to="/notifications" className="icon-btn" aria-label={`Notifications${badges.notifications ? `, ${badges.notifications} unread` : ''}`} style={{ position: 'relative' }}>
          {icons.notifications}
          {badges.notifications ? <span className="notification-dot" aria-hidden /> : null}
        </Link>
        <Link to="/support" className="icon-btn" aria-label="Support">
          {icons.support}
        </Link>
        <ProfileMenu />
      </div>
    </header>
  );
}
