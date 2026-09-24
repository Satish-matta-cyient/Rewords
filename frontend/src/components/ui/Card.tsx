import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className = '', children, ...rest }: CardProps) {
  return (
    <div className={`card${interactive ? ' card--interactive' : ''} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card__header">
      <div>
        <div className="card__title">{title}</div>
        {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card__body ${className}`.trim()}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className="card__footer">{children}</div>;
}
