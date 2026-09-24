import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, required, id, children }: FieldShellProps) {
  return (
    <div className="field">
      {label ? (
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? <span className="field__required" aria-hidden>*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span className="field__error" role="alert">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; hint?: string; error?: string; icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, id, className = '', ...rest }, ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} required={rest.required} id={inputId}>
      <div className="input-wrap">
        {icon ? <span className="input-wrap__icon" aria-hidden>{icon}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={`input${icon ? ' input--prefixed' : ''} ${className}`.trim()}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; hint?: string; error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className = '', ...rest }, ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} required={rest.required} id={inputId}>
      <textarea ref={ref} id={inputId} className={`textarea ${className}`.trim()} aria-invalid={error ? 'true' : undefined} {...rest} />
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; hint?: string; error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, id, className = '', ...rest }, ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} required={rest.required} id={inputId}>
      <select ref={ref} id={inputId} className={`select ${className}`.trim()} aria-invalid={error ? 'true' : undefined} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
});

export function Checkbox({ label, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label className="checkbox-row" htmlFor={id}>
        <input id={id} type="checkbox" {...rest} />
        <span className="small">{label}</span>
      </label>
      {error ? <span className="field__error" role="alert">{error}</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: {
  checked: boolean; onChange: (value: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="row-between">
      <div>
        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{label}</div>
        {description ? <div className="small muted">{description}</div> : null}
      </div>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" />
        <span className="switch__thumb" />
      </span>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: {
  value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
      icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>}
    />
  );
}
