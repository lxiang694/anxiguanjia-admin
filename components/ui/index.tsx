import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/* ========================================================================== */
/* Badge                                                                       */
/* ========================================================================== */

export type Tone = 'neutral' | 'brand' | 'warm' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  warm: 'bg-warm-50 text-warm-700 ring-warm-200',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  info: 'bg-info-50 text-info-600 ring-info-100',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ========================================================================== */
/* Card                                                                        */
/* ========================================================================== */

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-cream-200 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold text-ink-800">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

/* ========================================================================== */
/* Button                                                                      */
/* ========================================================================== */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warm';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-200',
  secondary:
    'border border-cream-400 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:text-ink-300',
  ghost: 'text-ink-600 hover:bg-cream-200 hover:text-ink-800',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 disabled:bg-danger-300',
  warm: 'bg-warm-400 text-white hover:bg-warm-500 disabled:bg-warm-200',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = 'secondary',
  size = 'md',
  className,
}: {
  children: React.ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ========================================================================== */
/* 状态展示                                                                     */
/* ========================================================================== */

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-cream-200 text-ink-400">
        {icon ?? <Info className="h-5 w-5" />}
      </div>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-ink-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNotice({
  title = '出了点问题',
  message,
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-danger-100 bg-danger-50 px-5 py-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-danger-700">{title}</p>
          {message ? (
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-danger-600">
              {message}
            </p>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 数据展示                                                                     */
/* ========================================================================== */

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  href?: string;
}) {
  const accent: Record<Tone, string> = {
    neutral: 'text-ink-800',
    brand: 'text-brand-700',
    warm: 'text-warm-500',
    danger: 'text-danger-600',
    info: 'text-info-600',
  };

  const inner = (
    <>
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', accent[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-400">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card block px-4 py-3.5 transition hover:border-brand-300 hover:shadow-lift"
      >
        {inner}
      </Link>
    );
  }
  return <div className="card px-4 py-3.5">{inner}</div>;
}

export function DescRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm', className)}>
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-ink-800">{children}</dd>
    </div>
  );
}

export function Table({
  head,
  children,
  className,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-cream-300 bg-cream-50 text-left">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2.5 text-[13px] font-medium text-ink-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-cream-200">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn('px-4 py-3 align-middle text-ink-700', className)}>{children}</td>;
}

/* ========================================================================== */
/* 合规提示                                                                     */
/* ========================================================================== */

/** 非医疗声明。任何出现健康相关内容的页面都必须展示。 */
export function NonMedicalNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs leading-relaxed text-ink-500',
        className,
      )}
    >
      {
        '本系统记录的是安心专员的服务观察与家庭提供的信息，不构成任何医疗诊断、治疗建议或医疗结论。如有健康疑虑，请咨询专业医疗机构。'
      }
    </p>
  );
}

/** 示例数据标记。不能把虚构数据当成公司真实案例展示。 */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
        'bg-warm-50 text-warm-600 ring-1 ring-inset ring-warm-200',
        className,
      )}
      title="此条为便于演示而虚构的示例数据，不代表真实客户"
    >
      示例数据
    </span>
  );
}

export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;
  return (
    <div className="border-b border-warm-200 bg-warm-50 px-4 py-2 text-center text-xs text-warm-700">
      <span className="font-semibold">演示环境</span>
      ：本环境中的家庭、长辈、安心专员、学历、培训与服务数据均为虚构的示例数据，不代表公司真实客户或真实案例。
    </div>
  );
}

/** 未核验信息的提示。学历未核验时严禁显示「已认证」。 */
export function UnverifiedHint({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-400">
      <AlertTriangle className="h-3 w-3" />
      {label}未核验
    </span>
  );
}
