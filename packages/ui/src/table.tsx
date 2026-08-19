import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Operational tables (spec §27.4). Dense, scannable, and horizontally scrollable inside their
 * own container so a wide table never makes the page scroll sideways.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('min-w-full divide-y divide-slate-200 text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>;
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr className={cn(onClick && 'cursor-pointer hover:bg-slate-50', className)} onClick={onClick}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <td className={cn('px-3 py-2.5 align-middle text-slate-800', className)} {...props}>
      {children}
    </td>
  );
}
