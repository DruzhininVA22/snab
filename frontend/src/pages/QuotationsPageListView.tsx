import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, fixPath } from '../api/_http';

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
};

type QuoteLine = {
  id: number;
  quote: number;
  item?: number | null;
  item_name?: string | null;
  is_blocked?: boolean;
  requested_qty?: number | null;
};

type PrMeta = {
  projectName?: string;
  stageName?: string;
};

function pickId(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object') {
    const n = Number((v as any).id ?? (v as any).pk);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function tryGetJson(urls: string[], params?: any): Promise<any | null> {
  for (const u of urls) {
    try {
      const { data } = await http.get(fixPath(u), params ? { params } : undefined);
      return data;
    } catch {
      // try next
    }
  }
  return null;
}

function fmtMoney(amount: number, currency?: string) {
  const c = currency || 'RUB';
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: c }).format(amount ?? 0);
  } catch {
    return `${amount ?? 0} ${c}`;
  }
}

const statusLabels: Record<string, string> = {
  received: 'Получено',
  reviewed: 'Рассмотрено',
  selected: 'Утверждено',
  rejected: 'Отклонено',
};

export default function QuotationsListView() {
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();

  const params = new URLSearchParams(loc.search);
  const prFilter = params.get('purchase_request_id') || params.get('purchase_request');

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [prMeta, setPrMeta] = React.useState<Record<number, PrMeta>>({});

  const {
    data: quotations = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Quote[]>({
    queryKey: ['quotations', prFilter || 'all'],
    queryFn: async () => {
      const url = prFilter
        ? fixPath(`/api/procurement/quotes/?purchase_request_id=${prFilter}`)
        : fixPath('/api/procurement/quotes/');
      const res = await http.get(url);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      return raw as Quote[];
    },
  });

  React.useEffect(() => {
    if (!selectedId && quotations.length) setSelectedId(quotations[0].id);
  }, [quotations, selectedId]);

  const selected = React.useMemo(
    () => quotations.find((q) => q.id === selectedId) || null,
    [quotations, selectedId]
  );

  const selectedPrId = selected?.purchase_request_id ? Number(selected.purchase_request_id) : null;
  const meta = selectedPrId ? prMeta[selectedPrId] : null;

  // подтягиваем мету (проект/этап) по заявке
  React.useEffect(() => {
    let alive = true;

    (async () => {
      const need: number[] = [];
      for (const q of quotations) {
        const prId = Number(q.purchase_request_id || 0);
        if (prId && !prMeta[prId]) need.push(prId);
      }
      if (!need.length) return;

      const next: Record<number, PrMeta> = { ...prMeta };

      for (const prId of need.slice(0, 30)) {
        const pr = await tryGetJson([`/api/procurement/purchase-requests/${prId}/`]);
        if (!alive) return;

        if (!pr) {
          next[prId] = {};
          continue;
        }

        const projectId = pickId(pr?.project ?? pr?.project_id ?? pr?.projectId ?? pr?.project_display);
        const stageId = pickId(
          pr?.stage ??
            pr?.stage_id ??
            pr?.project_stage ??
            pr?.project_stage_id ??
            pr?.project_stage_display ??
            pr?.stage_display
        );

        let projectName = '—';
        if (projectId) {
          const prj = await tryGetJson([`/api/projects/projects/${projectId}/`, `/api/projects/${projectId}/`]);
          projectName = prj
            ? prj.code
              ? `${prj.code} — ${prj.name ?? ''}`
              : prj.name ?? `#${projectId}`
            : `#${projectId}`;
        }

        let stageName = '—';
        if (stageId) {
          const st = await tryGetJson(
            [
              `/api/projects/stages/${stageId}/`,
              `/api/projects/project-stages/${stageId}/`,
              `/api/projects/projectstages/${stageId}/`,
              `/api/projects/stage/${stageId}/`,
            ],
            projectId ? { project: projectId } : undefined
          );
          stageName = st
            ? st.code
              ? `${st.code} — ${st.name ?? ''}`
              : st.name ?? `#${stageId}`
            : `#${stageId}`;
        }

        next[prId] = { projectName, stageName };
      }

      if (alive) setPrMeta(next);
    })();

    return () => {
      alive = false;
    };
  }, [quotations]);

  // lines for right side summary (active only)
  const linesQuery = useQuery<QuoteLine[]>({
    queryKey: ['quote-lines', selectedId || 0],
    enabled: !!selectedId,
    queryFn: async () => {
      const res = await http.get(fixPath('/api/procurement/quote-lines/'), {
        params: { quote_id: selectedId, page_size: 1000 },
      });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      return raw as QuoteLine[];
    },
  });

  const activeLines = React.useMemo(() => {
    const arr = linesQuery.data || [];
    return arr.filter((ln) => !ln.is_blocked);
  }, [linesQuery.data]);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await http.delete(fixPath(`/api/procurement/quotes/${id}/`));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['quotations'] });
      setSelectedId(null);
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await http.patch(fixPath(`/api/procurement/quotes/${id}/`), { status });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  const createPOMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await http.post(fixPath(`/api/procurement/quotes/${id}/create_po/`), {});
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      alert('Заказ сформирован');
    },
  });

  const openDetail = (id: number) => {
    const p = new URLSearchParams(loc.search);
    p.set('quote_id', String(id));
    nav(fixPath(`/quotes?${p.toString()}`));
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Коммерческие предложения</Typography>
        <Tooltip title="Обновить">
          <IconButton onClick={() => refetch()} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {error ? (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography color="error">Ошибка загрузки КП: {(error as any)?.message || 'unknown'}</Typography>
        </Paper>
      ) : null}

      <Grid container spacing={2}>
        <Grid item xs={12} md={9}>
          <Card>
            <CardContent>
              {isLoading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Загрузка…</Typography>
                </Stack>
              ) : (
                <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                  <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 44, fontSize: 12, p: '6px 8px' }}>ID</TableCell>
                        <TableCell sx={{ width: 64, fontSize: 12, p: '6px 8px' }}>Заявка</TableCell>
                        <TableCell sx={{ width: 140, fontSize: 12, p: '6px 8px' }}>Проект</TableCell>
                        <TableCell sx={{ width: 120, fontSize: 12, p: '6px 8px' }}>Этап</TableCell>
                        <TableCell sx={{ width: 130, fontSize: 12, p: '6px 8px' }}>Поставщик</TableCell>
                        <TableCell sx={{ width: 96, fontSize: 12, p: '6px 8px' }}>Сумма</TableCell>
                        <TableCell sx={{ width: 110, fontSize: 12, p: '6px 8px' }}>Статус</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {quotations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography variant="body2" color="text.secondary">
                              Нет КП. Создай КП из заявки через кнопку «Запросить КП».
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : null}

                      {quotations.map((q) => {
                        const prId = q.purchase_request_id ? Number(q.purchase_request_id) : null;
                        const m = prId ? prMeta[prId] : null;
                        const selectedRow = q.id === selectedId;

                        return (
                          <TableRow
                            key={q.id}
                            hover
                            selected={selectedRow}
                            onClick={() => setSelectedId(q.id)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell sx={{ fontSize: 12, p: '6px 8px' }}>{q.id}</TableCell>
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
                            >
                              {m?.projectName || '—'}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: 12,
                                p: '6px 8px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {m?.stageName || '—'}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: 12,
                                p: '6px 8px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {q.supplier_name}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, p: '6px 8px', whiteSpace: 'nowrap' }}>
                              {fmtMoney(q.total_price, q.currency)}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, p: '6px 8px' }}>
                              <Chip size="small" label={statusLabels[q.status] || q.status} />
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
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              {!selected ? (
                <Typography variant="body2" color="text.secondary">
                  Выберите КП слева для просмотра.
                </Typography>
              ) : (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">КП #{selected.id}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<OpenInNewIcon fontSize="small" />}
                        onClick={() => openDetail(selected.id)}
                      >
                        Открыть КП
                      </Button>
</Stack>
                  </Stack>

                  <Divider sx={{ my: 1.5 }} />

                  <Stack spacing={1}>
                    <Typography variant="body2">
                      <strong>Заявка:</strong> {selectedPrId ? `#${selectedPrId}` : '—'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Проект:</strong> {meta?.projectName || '—'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Этап:</strong> {meta?.stageName || '—'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Поставщик:</strong> {selected.supplier_name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Статус:</strong> {statusLabels[selected.status] || selected.status}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Сумма:</strong> {fmtMoney(selected.total_price, selected.currency)}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Управление КП перенесено на страницу заявки. Здесь — только просмотр.
                    </Typography>

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Позиции (активные)
                      </Typography>

                      {linesQuery.isLoading ? (
                        <Typography variant="body2" color="text.secondary">
                          Загрузка строк…
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            maxHeight: 320,
                            overflowY: 'auto',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                          }}
                        >
                          <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontSize: 12 }}>Номенклатура</TableCell>
                                <TableCell sx={{ width: 72, fontSize: 12 }} align="right">
                                  Кол-во
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {activeLines.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={2}>
                                    <Typography variant="body2" color="text.secondary">
                                      Нет активных позиций.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ) : null}

                              {activeLines.map((ln) => (
                                <TableRow key={ln.id} hover>
                                  <TableCell
                                    sx={{
                                      fontSize: 12,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {ln.item_name || `#${ln.item ?? ln.id}`}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 12 }} align="right">
                                    {ln.requested_qty ?? '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                    </Box>
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
