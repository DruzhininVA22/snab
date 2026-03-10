import * as React from 'react';
import { Chip, type ChipProps } from '@mui/material';

export type StatusEntity = 'purchase_request' | 'quote' | 'purchase_order' | 'shipment';

type StatusMeta = {
  label: string;
  short?: string;
  color?: ChipProps['color'];
};

function normStatus(status?: string | null): string {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'canceled') return 'cancelled';
  return s;
}

const MAP: Record<StatusEntity, Record<string, StatusMeta>> = {
  purchase_request: {
    draft: { label: 'Черновик', short: 'Черн.', color: 'default' },
    open: { label: 'В работе', short: 'В работе', color: 'info' },
    closed: { label: 'Закрыто', short: 'Закрыто', color: 'success' },
    cancelled: { label: 'Отменено', short: 'Отм.', color: 'error' },
  },
  quote: {
    received: { label: 'Получено', short: 'Получено', color: 'default' },
    reviewed: { label: 'Рассмотрено', short: 'Рассм.', color: 'info' },
    selected: { label: 'Утверждено', short: 'Утв.', color: 'success' },
    rejected: { label: 'Отклонено', short: 'Откл.', color: 'error' },
  },
  purchase_order: {
    draft: { label: 'Черновик', short: 'Черн.', color: 'default' },
    sent: { label: 'Отправлено', short: 'Отпр.', color: 'info' },
    confirmed: { label: 'Подтверждено', short: 'Подтв.', color: 'info' },
    paid: { label: 'Оплачено', short: 'Опл.', color: 'warning' },
    in_transit: { label: 'В пути', short: 'В пути', color: 'info' },
    delivered: { label: 'Доставлено', short: 'Дост.', color: 'success' },
    closed: { label: 'Закрыто', short: 'Закр.', color: 'success' },
    cancelled: { label: 'Отменено', short: 'Отм.', color: 'error' },
    pending: { label: 'Ожидание', short: 'Ожид.', color: 'default' },
  },
  shipment: {
    planned: { label: 'Планируется', short: 'План', color: 'default' },
    in_transit: { label: 'В пути', short: 'В пути', color: 'info' },
    delivered: { label: 'Доставлено', short: 'Дост.', color: 'success' },
    cancelled: { label: 'Отменено', short: 'Отм.', color: 'error' },
  },
};

export function getStatusMeta(entity: StatusEntity, status?: string | null): StatusMeta {
  const s = normStatus(status);
  return MAP[entity][s] || { label: s || '—', short: s || '—', color: 'default' };
}

export function getStatusLabel(
  entity: StatusEntity,
  status?: string | null,
  opts?: { compact?: boolean }
): string {
  const meta = getStatusMeta(entity, status);
  if (opts?.compact && meta.short) return meta.short;
  return meta.label;
}

export default function StatusChip(props: {
  entity: StatusEntity;
  status?: string | null;
  compact?: boolean;
  size?: ChipProps['size'];
  variant?: ChipProps['variant'];
  sx?: ChipProps['sx'];
}) {
  const { entity, status, compact, size = 'small', variant = 'filled', sx } = props;
  const meta = getStatusMeta(entity, status);
  return (
    <Chip
      component="span"
      size={size}
      variant={variant}
      color={meta.color || 'default'}
      label={compact && meta.short ? meta.short : meta.label}
      sx={[{ display: 'inline-flex' }, sx]}
    />
  );
}
