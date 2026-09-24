import { useUiStore } from '@/store/uiStore';
import { IconButton } from './Button';

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-region" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.variant}`} role={t.variant === 'error' ? 'alert' : 'status'}>
          <div className="grow">
            <div className="toast__title">{t.title}</div>
            {t.description ? <div className="toast__description">{t.description}</div> : null}
          </div>
          <IconButton label="Dismiss notification" onClick={() => dismiss(t.id)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </IconButton>
        </div>
      ))}
    </div>
  );
}
