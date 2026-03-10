import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { http, fixPath } from '../api/_http';
import StatusChip from '../components/StatusChip';

type Quote = {
  id: number;
  purchase_request_id?: number | null;
  supplier?: number | null;
  supplier_name: string;
  status: string;
  total_price: number;
  currency: string;
  delivery_days?: number | null;
  notes?: string | null;
  purchase_order_id?: number | null;
  purchase_order_number?: string | null;
  project_name?: string | null;
  stage_name?: string | null;
};

function fmtMoney(amount: number, currency?: string) {
  const c = currency || 'RUB';
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: c }).format(amount ?? 0);
  } catch {
    return `${amount ?? 0} ${c}`;
  }
}

function isQuoteCompleted(q: Quote): boolean {
  const st = String(q.status || '').toLowerCase();
  return !!q.purchase_order_id || st === 'selected' || st === 'rejected';
}

export default function QuotationsListView() {
  const nav = useNavigate();
  const loc = useLocation();

  const params = new URLSearchParams(loc.search);
  const prFilter = params.get('purchase_request_id') || params.get('purchase_request');

  const STORAGE_KEY_COMPLETED = 'snab.quotes.showCompleted';
  const [showCompleted, setShowCompleted] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COMPLETED) === '1';
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMPLETED, showCompleted ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showCompleted]);

  const [qText, setQText] = React.useState('');

  const {
    data: quotations = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Quote[]>({
    queryKey: ['quotations', prFilter || 'all'],
    queryFn: async () => {
      const url = prFilter
        ? fixPath(`/api/procurement/quotes/?purchase_request_id=${encodeURIComponent(String(prFilter))}`)
        : fixPath('/api/procurement/quotes/');
      const res = await http.get(url);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      return raw as Quote[];
    },
  });

  const filteredQuotations = React.useMemo(() => {
    const q = qText.trim().toLowerCase();
    return quotations.filter((it) => {
      if (!showCompleted && isQuoteCompleted(it)) return false;
      if (!q) return true;
      const hay = `${it.id} ${it.purchase_request_id ?? ''} ${it.supplier_name ?? ''} ${it.project_name ?? ''} ${it.stage_name ?? ''} ${it.notes ?? ''} ${it.purchase_order_number ?? ''}`
        .toLowerCase();
      return hay.includes(q);
    });
  }, [quotations, qText, showCompleted]);

  const openDetail = (id: number) => {
    const p = new URLSearchParams(loc.search);
    p.set('quote_id', String(id));
    nav(fixPath(`/quotes?${p.toString()}`));
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Typography variant="h5">Коммерческие предложения</Typography>
          {prFilter ? (
            <Chip
              size="small"
              variant="outlined"
              label={`Фильтр: заявка #${prFilter}`}
              onDelete={() => nav(fixPath('/quotes'))}
            />
          ) : null}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <TextField
            size="small"
            label="Поиск (поставщик / проект / этап / №)"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            sx={{ minWidth: { xs: 220, md: 360 } }}
          />
          <FormControlLabel
            sx={{ ml: 0.5, userSelect: 'none' }}
            control={<Checkbox checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />}
            label={<Typography variant="body2">Показывать завершённые</Typography>}
          />
          <Tooltip title="Обновить">
            <IconButton onClick={() => refetch()} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {error ? (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography color="error">Ошибка загрузки КП: {(error as any)?.message || 'unknown'}</Typography>
        </Paper>
      ) : null}

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Клик по строке открывает карточку КП.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Показано: {filteredQuotations.length}
            </Typography>
          </Stack>

          {isLoading ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={20} />
              <Typography variant="body2">Загрузка…</Typography>
            </Stack>
          ) : (
            <TableContainer sx={{ width: '100%', overflowX: 'hidden' }}>
              <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 52, fontSize: 12, p: '6px 8px' }}>ID</TableCell>
                    <TableCell sx={{ width: 72, fontSize: 12, p: '6px 8px' }}>Заявка</TableCell>
                    <TableCell sx={{ width: '20%', fontSize: 12, p: '6px 8px' }}>Проект</TableCell>
                    <TableCell sx={{ width: '24%', fontSize: 12, p: '6px 8px' }}>Этап</TableCell>
                    <TableCell sx={{ width: '18%', fontSize: 12, p: '6px 8px' }}>Поставщик</TableCell>
                    <TableCell sx={{ width: 120, fontSize: 12, p: '6px 8px' }}>Сумма</TableCell>
                    <TableCell sx={{ width: 136, fontSize: 12, p: '6px 8px' }}>Статус</TableCell>
                    <TableCell sx={{ width: 74, fontSize: 12, p: '6px 8px' }} align="center">
                      Открыть
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredQuotations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" color="text.secondary">
                          {prFilter ? <>По заявке #{prFilter} КП не найдено.</> : <>Нет КП по текущим фильтрам.</>}
                        </Typography>
                        {prFilter ? (
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => nav(fixPath(`/pr?purchase_request_id=${encodeURIComponent(String(prFilter))}`))}
                            >
                              Открыть заявку
                            </Button>
                          </Stack>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {filteredQuotations.map((q) => {
                    const prId = q.purchase_request_id ? Number(q.purchase_request_id) : null;
                    return (
                      <TableRow
                        key={q.id}
                        hover
                        onClick={() => openDetail(q.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ fontSize: 12, p: '6px 8px', whiteSpace: 'nowrap' }}>{q.id}</TableCell>
                        <TableCell sx={{ fontSize: 12, p: '6px 8px', whiteSpace: 'nowrap' }}>
                          {prId ? `#${prId}` : '—'}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: 12,
                            p: '6px 8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={q.project_name || ''}
                        >
                          {q.project_name || '—'}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: 12,
                            p: '6px 8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={q.stage_name || ''}
                        >
                          {q.stage_name || '—'}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: 12,
                            p: '6px 8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={q.supplier_name}
                        >
                          {q.supplier_name}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, p: '6px 8px', whiteSpace: 'nowrap' }}>
                          {fmtMoney(q.total_price, q.currency)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, p: '6px 8px' }}>
                          <Box sx={{ display: 'inline-flex', minWidth: 110 }}>
                            <StatusChip entity="quote" status={q.status} compact />
                          </Box>
                        </TableCell>
                        <TableCell sx={{ p: '6px 8px' }} align="center" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="Открыть КП">
                            <IconButton size="small" onClick={() => openDetail(q.id)}>
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
