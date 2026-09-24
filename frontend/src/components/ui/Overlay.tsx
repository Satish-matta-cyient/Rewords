import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton } from './Button';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

/**
 * Shared overlay behaviour: escape to close, focus trapping, focus restore
 * and background scroll lock. Both Dialog and Drawer build on it.
 */
function useOverlay(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', handleKey);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus());

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose, ref]);
}

export function Dialog({ open, onClose, title, description, children, footer }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children?: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, ref);
  if (!open) return null;

  return createPortal(
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog__header">
          <div className="row-between">
            <div>
              <h2 className="dialog__title" id="dialog-title">{title}</h2>
              {description ? <p className="dialog__description">{description}</p> : null}
            </div>
            <IconButton label="Close dialog" onClick={onClose}><CloseIcon /></IconButton>
          </div>
        </div>
        {children ? <div className="dialog__body">{children}</div> : null}
        {footer ? <div className="dialog__footer">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', destructive, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description: string; confirmLabel?: string; destructive?: boolean; loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    />
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: ReactNode;
  children: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, ref);
  if (!open) return null;

  return createPortal(
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer__header">
          <div>
            <h2 className="dialog__title" id="drawer-title">{title}</h2>
            {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
          </div>
          <IconButton label="Close panel" onClick={onClose}><CloseIcon /></IconButton>
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="drawer__footer">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}
