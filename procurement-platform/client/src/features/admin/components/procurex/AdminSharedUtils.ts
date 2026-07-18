import { useState } from 'react';
import type { AdminApp } from '@/features/admin/api';

export type AdminCommandConfig = {
  title: string;
  summary: string;
  confirmLabel?: string;
  confirmText?: string;
  defaultNote?: string;
  dangerous?: boolean;
  fields?: Array<{ key: string; label: string; placeholder?: string; required?: boolean; type?: string }>;
  run: (note: string, fields: Record<string, string>) => Promise<unknown>;
  onComplete?: (result: unknown) => void;
};

export const adminAppRegistry: AdminApp[] = [
  {
    key: 'command-center',
    title: 'Command Center',
    description: 'Platform-wide oversight for compliance, risk, admin actions, and procurement activity.',
    route: '/admin',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/dashboard', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'user-management',
    title: 'User Management',
    description: 'Review verification queues, inspect user registry data, and record account actions.',
    route: '/admin/users',
    group: 'primary',
    backend: { module: 'compliance-admin + identity', endpoint: '/api/compliance-admin/users + /api/identity/admin/verifications', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'platform-analytics',
    title: 'Platform Analytics',
    description: 'View aggregate activity, workflow, procurement value, compliance, and risk metrics.',
    route: '/admin/analytics',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/analytics', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'full-audit-trail',
    title: 'Full Audit Trail',
    description: 'Trace system events, admin actions, authentication, verification, and compliance evidence.',
    route: '/admin/audit',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/audit/events', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'tender-review',
    title: 'Tender Review',
    description: 'Review newly submitted tenders before marketplace publication.',
    route: '/admin/tender-review',
    group: 'primary',
    backend: { module: 'procurement', endpoint: '/api/procurement/admin/tender-review', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'communication-center',
    title: 'Communication Center',
    description: 'Messages, clarifications, alerts, and admin-visible communication activity.',
    route: '/admin/communication',
    group: 'secondary',
    backend: { module: 'communication', endpoint: '/api/communication', status: 'live' },
    generatedAt: ''
  },
  {
    key: 'admin-profile',
    title: 'Admin Profile',
    description: 'Admin identity profile, preferences, verification context, and account controls.',
    route: '/admin/profile',
    group: 'secondary',
    backend: { module: 'identity', endpoint: '/api/identity/me + /api/identity/profile', status: 'live' },
    generatedAt: ''
  }
];

export function useAdminCommand() {
  const [command, setCommand] = useState<AdminCommandConfig | null>(null);
  const [undoAction, setUndoAction] = useState<{ id: string; label: string } | null>(null);
  return {
    command,
    openCommand: setCommand,
    closeCommand: () => setCommand(null),
    undoAction,
    setUndoAction
  };
}

export function badgeClass(value?: string) {
  const lower = (value ?? '').toLowerCase();
  if (['approved', 'active', 'open', 'clear', 'low', 'published', 'submitted'].some((word) => lower.includes(word))) return 'badge badge-success';
  if (['pending', 'review', 'warning', 'medium', 'draft', 'investigation'].some((word) => lower.includes(word))) return 'badge badge-warning';
  if (['rejected', 'critical', 'error', 'blocked', 'high', 'escalated', 'expired'].some((word) => lower.includes(word))) return 'badge badge-error';
  return 'badge badge-info';
}

export function displayLabel(value?: string | null) {
  if (!value) return 'Not set';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-TZ', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function compactNumber(value: number | undefined) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);
}

export function initials(name?: string | null) {
  return (name || 'Admin')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function maxCount(items: Array<{ count: number }>) {
  return Math.max(1, ...items.map((item) => item.count));
}

export function exportCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? '';
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(',')
    )
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printAdminPage() {
  window.print();
}
