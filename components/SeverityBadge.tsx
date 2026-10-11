import React from 'react';
import {
  XOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  type LucideProps,
} from 'lucide-react';

type Severity = 'critical' | 'serious' | 'moderate' | 'minor' | 'resolved';

interface SeverityConfig {
  label: string;
  className: string;
  Icon: React.ComponentType<LucideProps>;
}

const SEVERITY_MAP: Record<Severity, SeverityConfig> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-800 border-red-300',
    Icon: XOctagon,
  },
  serious: {
    label: 'Serious',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    Icon: AlertTriangle,
  },
  moderate: {
    label: 'Moderate',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    Icon: AlertCircle,
  },
  minor: {
    label: 'Minor',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
    Icon: Info,
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Icon: CheckCircle2,
  },
};

interface SeverityBadgeProps {
  impact: string | null;
  className?: string;
}

export function SeverityBadge({ impact, className = '' }: SeverityBadgeProps) {
  let normalized = (impact ?? 'minor').toLowerCase();
  if (normalized === 'high') normalized = 'serious';
  if (normalized === 'medium') normalized = 'moderate';
  if (normalized === 'low') normalized = 'minor';

  const config = SEVERITY_MAP[normalized as Severity] ?? SEVERITY_MAP.minor;
  const { label, className: badgeClass, Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${badgeClass} ${className}`}
    >
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}
