// OperationalTable — white rows + left severity bar
import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useQuery } from '@tanstack/react-query';
import { http, fixPath } from '../../api/_http';

type DocType = 'pr' | 'quote' | 'po' | 'shipment';
type Severity = 'overdue' | 'due_soon' | 'ok';

type OpsRow = {
  type: DocType;
  id: number;
  title: string;
  party: string;
  status: string;
  deadlineIso: string | null;
  daysLeft: number | null;
  severity: Severity;
  frontend_url?: string | null;
  frontendUrl?: string | null;
  deadline_iso?: string | null;
  days_left?: number | null;
};

const DUE_SOON_DAYS = 3;

const typeLabels: Record<DocType, string> = {
  pr: 'Заявки',
  quote: 'КП',
  po: 'Заказы',
  shipment: 'Доставки',
};

const statusRu: Record<string, string> = {
  draft: 'Черновик',
  open: 'В исполнении',
  in_progress: 'В работе',
  sent: 'Отправлена',
  received: 'Получено',
  reviewed: 'Рассмотрено',
  selected: 'Утверждено',
  approved: 'Утверждено',
  rejected: 'Отклонено',
  cancelled: 'Отменено',
  canceled: 'Отменено',
  closed: 'Закрыто',
  done: 'Завершено',
  delivered: 'Доставлено',
  paid: 'Оплачено',
  confirmed: 'Подтверждено',
  in_transit: 'В пути',
};

function sortRows(a: OpsRow, b: OpsRow) {
  const rank = (s: Severity) => (s === 'overdue' ? 0 : s === 'due_soon' ? 1 : 2);
    const ra = rank(a.severity);
  const rb = rank(b.severity);
  if (ra !== rb) return ra - rb;

  const da = (a.daysLeft ?? a.days_left) ?? 999999;
  const db = (b.daysLeft ?? b.days_left) ?? 999999;
  if (da !== db) return da - db;

  return a.id - b.id;
}

function openUrl(row: OpsRow) {
  const url = row.frontendUrl || row.frontend_url;
  if (url) {
    window.location.href = fixPath(url);
    return;
  }
  if (row.type === 'pr') window.location.href = fixPath(`/pr/${row.id}/edit`);
  if (row.type === 'quote') window.location.href = fixPath(`/quotes?quote_id=${row.id}`);
  if (row.type === 'po') window.location.href = fixPath(`/purchase-orders`);
  if (row.type === 'shipment') window.location.href = fixPath(`/shipments`);
}

function fmtDeadline(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString();
  } catch {
    return String(iso);
  }
}
// ---- Color utilities: keep overdue / due_soon visually distinct even if theme palette is close ----
type RGB = [number, number, number];

function parseColorToRgb(color: string): RGB | null {
  if (!color) return null;

  // #RGB / #RRGGBB
  if (color.startsWith('#')) {
    const hex = color.slice(1).trim();
    const norm = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (norm.length !== 6) return null;
    const r = parseInt(norm.slice(0, 2), 16);
    const g = parseInt(norm.slice(2, 4), 16);
    const b = parseInt(norm.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return [r, g, b];
  }

  // rgb() / rgba()
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length < 3) return null;
    const [r, g, b] = parts;
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
  }

  return null;
}

function colorDistance(a: string, b: string): number | null {
  const ra = parseColorToRgb(a);
  const rb = parseColorToRgb(b);
  if (!ra || !rb) return null;
  const dr = ra[0] - rb[0];
  const dg = ra[1] - rb[1];
  const db = ra[2] - rb[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}


export default function OperationalTable() {
  const theme = useTheme();
  const [tab, setTab] = React.useState<DocType>('pr');

  const opsQ = useQuery({
    queryKey: ['dashboard-ops'],
    queryFn: async () => {
      const { data } = await http.get(fixPath('/api/dashboard/ops/'));
      return data as any;
    },
  });

  const api = opsQ.data || {};
  const groups = api.groups || {};
  const rows: OpsRow[] = (groups[tab]?.rows || []).slice().sort(sortRows);
    const sevColors = React.useMemo(() => {
    // Hard-coded, high-contrast semantic colors to avoid theme palettes making overdue/critical look the same.
    // overdue = red (пожар), due_soon = amber (срочно), ok = green (под контролем)
    const OVERDUE = '#d32f2f';
    const DUE_SOON = '#f9a825';
    const OK = '#2e7d32';

    return {
      overdue: {
        bar: OVERDUE,
        bg: alpha(OVERDUE, 0.18),
        hover: alpha(OVERDUE, 0.28),
        text: OVERDUE,
      },
      due_soon: {
        bar: DUE_SOON,
        bg: alpha(DUE_SOON, 0.12),
        hover: alpha(DUE_SOON, 0.20),
        text: DUE_SOON,
      },
      ok: {
        bar: OK,
        bg: theme.palette.background.paper,
        hover: theme.palette.action.hover,
        text: OK,
      },
    } as const;
  }, [theme]);
  const rowSx = (sev: Severity) => {
    const c = sevColors[sev];
    const isOverdue = sev === 'overdue';
    const isDueSoon = sev === 'due_soon';

    return {
      '& > td': {
        color: theme.palette.text.primary,
        bgcolor: c.bg,
        ...(isOverdue
          ? {
              // a subtle inner outline to scream "пожар" without painting the whole row bright red
              boxShadow: `inset 0 0 0 1px ${alpha(c.bar, 0.35)}`,
            }
          : null),
      },
      // NOTE: border on <tr> often does not render in tables; apply to the first cell.
      '& > td:first-of-type': {
        borderLeft: `${isOverdue ? 8 : 6}px solid ${c.bar}`,
        pl: 1,
        borderLeftColor: `${c.bar}` as any,
      },
      ...(isOverdue
        ? {
            '& > td:nth-of-type(5), & > td:nth-of-type(6)': {
              color: c.text,
              fontWeight: 800,
            },
          }
        : isDueSoon
          ? {
              '& > td:nth-of-type(5), & > td:nth-of-type(6)': {
                color: c.text,
                fontWeight: 700,
              },
            }
          : null),
      '&:hover > td': {
        bgcolor: c.hover,
      },
    };
  };
  const docCellSx = (sev: Severity) => {
    const c = sevColors[sev];
    if (sev === 'overdue') return { color: c.text, fontWeight: 900 };
    if (sev === 'due_soon') return { color: c.text, fontWeight: 750 };
        return { color: sevColors.ok.text, fontWeight: 600 };
  };

  const deadlineKey = (r: OpsRow) => r.deadlineIso ?? r.deadline_iso ?? null;
  const daysKey = (r: OpsRow) => (r.daysLeft ?? r.days_left);

  

  const pad2 = (n: number) => String(n).padStart(2, '0');

  const localTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const deadlineDateStr = (r: OpsRow) => {
    const iso = deadlineKey(r);
    if (!iso) return null;
    // accept both full ISO and date-only strings
    return iso.slice(0, 10);
  };

  // Frontend safety net:
  // if backend severity/days are inconsistent, we still must show clearly overdue rows as red.
  const effectiveSeverity = (r: OpsRow): Severity => {
    const dl = deadlineDateStr(r);
    if (dl) {
      const today = localTodayStr();
      if (dl < today) return 'overdue';
    }
    return r.severity;
  };
return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6">Операционная таблица</Typography>
          <Tooltip title="Обновить">
            <IconButton size="small" onClick={() => opsQ.refetch()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {api?.errors && Object.keys(api.errors).length ? (
          <Box sx={{ mb: 1, p: 1.25, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="body2">
              Некоторые группы недоступны: {Object.entries(api.errors).map(([k, v]) => `${k}: ${v}`).join(', ')}
            </Typography>
          </Box>
        ) : null}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 1 }}>
          <Tab value="pr" label={typeLabels.pr} />
          <Tab value="quote" label={typeLabels.quote} />
          <Tab value="po" label={typeLabels.po} />
          <Tab value="shipment" label={typeLabels.shipment} />
        </Tabs>

        {opsQ.isLoading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Загрузка…</Typography>
          </Stack>
        ) : (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 70 }}>ID</TableCell>
                  <TableCell>Документ</TableCell>
                  <TableCell sx={{ width: 220 }}>Контрагент/Объект</TableCell>
                  <TableCell sx={{ width: 140 }}>Статус</TableCell>
                  <TableCell sx={{ width: 140 }}>Дедлайн</TableCell>
                  <TableCell sx={{ width: 90 }} align="right">
                    Дней
                  </TableCell>
                  <TableCell sx={{ width: 56 }} />
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        Нет активных документов.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}

                {rows.map((r) => (
                  <TableRow key={`${r.type}-${r.id}`} sx={rowSx(effectiveSeverity(r))} hover>
                    <TableCell>{r.id}</TableCell>
                    <TableCell
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        ...docCellSx(effectiveSeverity(r)),
                      }}
                      title={r.title}
                    >
                      {r.title}
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.party}>
                      {r.party || '—'}
                    </TableCell>
                    <TableCell>{statusRu[(r.status || '').toLowerCase()] || r.status}</TableCell>
                    <TableCell>{fmtDeadline(deadlineKey(r))}</TableCell>
                    <TableCell align="right">{daysKey(r) == null ? '—' : daysKey(r)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Открыть">
                        <IconButton size="small" onClick={() => openUrl(r)}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Просроченные — красные ("пожар"), критичные — жёлтые (≤ {DUE_SOON_DAYS} рабочих дня), остальные — зелёные (под контролем).
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
