import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

const CONTROL_BASE =
  'block w-full rounded-md border-0 bg-white px-3 py-2 text-slate-900 shadow-sm ring-1 ring-inset ' +
  'ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 ' +
  'disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm';

const INVALID = 'ring-red-400 focus:ring-red-500';

export type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Renders the masked-value warning used for sensitive fields (spec §16.2). */
  sensitive?: boolean;
  /** Text shown in the sensitive badge. The caller supplies a translated string. */
  sensitiveLabel?: string;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  sensitive,
  sensitiveLabel,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-800"
      >
        {label}
        {required ? (
          <span aria-hidden className="text-red-600">
            *
          </span>
        ) : null}
        {sensitive ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
            {sensitiveLabel ?? 'sensitive'}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, invalid && INVALID, className)}
      {...props}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, invalid && INVALID, className)}
      {...props}
    >
      {children}
    </select>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, 'min-h-[80px]', invalid && INVALID, className)}
      {...props}
    />
  );
});

/** Label + control in one call, for the many simple cases. */
export function TextField({
  label,
  hint,
  error,
  required,
  sensitive,
  sensitiveLabel,
  className,
  ...inputProps
}: Omit<FieldProps, 'children' | 'htmlFor'> & InputProps) {
  const id = useId();
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      required={required}
      sensitive={sensitive}
      sensitiveLabel={sensitiveLabel}
      className={className}
    >
      <Input id={id} invalid={Boolean(error)} required={required} {...inputProps} />
    </Field>
  );
}
