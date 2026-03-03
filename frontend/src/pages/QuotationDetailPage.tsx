import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
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
  Typography,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, fixPath } from '../api/_http';

type Quote = {
  id: number;
  purchase_request_id?: number | null;
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
  supplier_sku?: string | null;
  price?: number | null;
  lead_time_days?: number | null;
  min_quantity?: number | null;
  package_quantity?: number | null;
  quantity_step?: number | null;
  is_blocked?: boolean;
  requested_qty?: number | null;
};

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

type Props = { quoteId: number };

type EditKeys = {
  sku: string;
  price: string;
  lead: string;
  moq: string;
  pack: string;
  step: string;
};

function deriveEditKeys(ln: any): EditKeys {
  const has = (k: string) => ln && Object.prototype.hasOwnProperty.call(ln, k);
  return {
    sku: has('supplier_sku') ? 'supplier_sku' : 'supplier_sku',
    price: has('price') ? 'price' : 'price',
    lead: has('lead_time_days') ? 'lead_time_days' : (has('lead_days') ? 'lead_days' : 'lead_time_days'),
    moq: has('min_quantity') ? 'min_quantity' : (has('moq_qty') ? 'moq_qty' : 'min_quantity'),
    pack: has('package_quantity') ? 'package_quantity' : (has('pack_qty') ? 'pack_qty' : 'package_quantity'),
    step: has('quantity_step') ? 'quantity_step' : (has('lot_step') ? 'lot_step' : 'quantity_step'),
  };
}

function toNumOrNull(v: any): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


export default function QuotationDetailPage({ quoteId }: Props) {
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();

  const [q, setQ] = React.useState('');
  const [editOpen, setEditOpen] = React.useState(false);
  const [editLine, setEditLine] = React.useState<any | null>(null);
  const [editKeys, setEditKeys] = React.useState<EditKeys | null>(null);

  const quoteQuery = useQuery<Quote>({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      const { data } = await http.get(fixPath(`/api/procurement/quotes/${quoteId}/`));
      return data as Quote;
    },
  });

  const linesQuery = useQuery<QuoteLine[]>({
    queryKey: ['quote-lines', quoteId],
    queryFn: async () => {
      const res = await http.get(fixPath('/api/procurement/quote-lines/'), {
        params: { quote_id: quoteId, page_size: 5000 },
      });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      return raw as QuoteLine[];
    },
  });

  const lines = React.useMemo(() => {
    const arr = linesQuery.data || [];
    const qq = q.trim().toLowerCase();
    if (!qq) return arr;
    return arr.filter((ln) => {
      const s = `${ln.item_name || ''} ${ln.supplier_sku || ''}`.toLowerCase();
      return s.includes(qq);
    });
  }, [linesQuery.data, q]);

  const backToList = () => {
    const p = new URLSearchParams(loc.search);
    p.delete('quote_id');
    const qs = p.toString();
    nav(fixPath(qs ? `/quotes?${qs}` : '/quotes'));
  };

  const toggleBlockedMut = useMutation({
  mutationFn: async ({ id, is_blocked }: { id: number; is_blocked: boolean }) => {
    const { data } = await http.patch(fixPath(`/api/procurement/quote-lines/${id}/`), { is_blocked });
    return data;
  },
  onSuccess: async (data: any) => {
    // Мгновенно обновим кэш, чтобы пользователь видел результат сразу
    qc.setQueryData(['quote-lines', quoteId], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((x) => (x.id === data.id ? { ...x, ...data } : x));
    });
    await linesQuery.refetch();
  },
  onError: (e: any) => {
    const msg = e?.response?.data ? JSON.stringify(e.response.data) : (e?.message || 'unknown');
    alert('Не удалось изменить блокировку строки КП: ' + msg);
  },
});

  
const saveLineMut = useMutation({
  mutationFn: async (payload: any & { id: number }) => {
    const { id, ...body } = payload;
    const { data } = await http.patch(fixPath(`/api/procurement/quote-lines/${id}/`), body);
    return data;
  },
  onSuccess: async (data: any) => {
    qc.setQueryData(['quote-lines', quoteId], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((x) => (x.id === data.id ? { ...x, ...data } : x));
    });
    await linesQuery.refetch();
    setEditOpen(false);
    setEditLine(null);
    setEditKeys(null);
  },
  onError: (e: any) => {
    const msg = e?.response?.data ? JSON.stringify(e.response.data) : (e?.message || 'unknown');
    alert('Не удалось сохранить строку КП: ' + msg);
  },
});

const createPOMut = useMutation({
    mutationFn: async () => {
      const res = await http.post(fixPath(`/api/procurement/quotes/${quoteId}/create_po/`), {});
      return res.data;
    },
    onSuccess: async () => {
      alert('Заказ сформирован. КП считается зафиксированным (read-only).');
      await qc.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });

  const openEdit = (ln: any) => {
    setEditKeys(deriveEditKeys(ln));
    setEditLine({ ...ln });
    setEditOpen(true);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton onClick={backToList} size="small">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5">КП #{quoteId}</Typography>
        </Stack>
        <Tooltip title="Обновить">
          <IconButton onClick={() => { void quoteQuery.refetch(); void linesQuery.refetch(); }} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {quoteQuery.isLoading ? (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2">Загрузка КП…</Typography>
          </Stack>
        </Paper>
      ) : quoteQuery.error ? (
        <Paper sx={{ p: 2 }}>
          <Typography color="error">Ошибка загрузки КП</Typography>
        </Paper>
      ) : (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Поставщик:</strong> {quoteQuery.data?.supplier_name}
              </Typography>
              <Typography variant="body2">
                <strong>Заявка:</strong> {quoteQuery.data?.purchase_request_id ? `#${quoteQuery.data.purchase_request_id}` : '—'}
              </Typography>
              <Typography variant="body2">
                <strong>Статус:</strong> <Chip size="small" label={statusLabels[quoteQuery.data?.status || ''] || quoteQuery.data?.status} />
              </Typography>
              <Typography variant="body2">
                <strong>Сумма:</strong> {fmtMoney(quoteQuery.data?.total_price || 0, quoteQuery.data?.currency)}
              </Typography>

              <Divider />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                <Button
                  variant="contained"
                  size="small"
                  sx={{ textTransform: 'none' }}
                  onClick={() => createPOMut.mutate()}
                  disabled={createPOMut.isPending}
                >
                  Сформировать заказ
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ textTransform: 'none' }}
                  onClick={() => nav(fixPath(`/po`))}
                >
                  Перейти к заказам
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6">Позиции КП</Typography>
            <TextField
              size="small"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по наименованию / SKU"
              sx={{ minWidth: { xs: '100%', sm: 360 } }}
            />
          </Stack>

          {linesQuery.isLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2">Загрузка строк…</Typography>
            </Stack>
          ) : (
            <TableContainer sx={{ maxHeight: '70vh' }}>
              <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 44 }}>Блок</TableCell>
                    <TableCell>Номенклатура</TableCell>
                    <TableCell sx={{ width: 100 }} align="right">
                      Кол-во
                    </TableCell>
                    <TableCell sx={{ width: 120 }} align="right">
                      Цена
                    </TableCell>
                    <TableCell sx={{ width: 90 }} align="right">
                      Срок
                    </TableCell>
                    <TableCell sx={{ width: 90 }} align="right">
                      Действия
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          Нет строк.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {lines.map((ln) => {
                    const blocked = !!ln.is_blocked;
                    return (
                      <TableRow key={ln.id} hover sx={blocked ? { opacity: 0.6 } : undefined}>
                        <TableCell>
                          <Checkbox
                            size="small"
                            checked={blocked}
                            onChange={() => toggleBlockedMut.mutate({ id: ln.id, is_blocked: !blocked })}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textDecoration: blocked ? 'line-through' : 'none',
                          }}
                          title={ln.item_name || ''}
                        >
                          {ln.item_name || `#${ln.item ?? ln.id}`}
                        </TableCell>
                        <TableCell align="right">{ln.requested_qty ?? '—'}</TableCell>
                        <TableCell align="right">{ln.price ?? '—'}</TableCell>
                        <TableCell align="right">{ln.lead_time_days ?? '—'}</TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => openEdit(ln)} sx={{ textTransform: 'none' }}>
                            Править
                          </Button>
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

      <Dialog open={editOpen} onClose={() => { setEditOpen(false); setEditLine(null); setEditKeys(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Редактирование строки КП</DialogTitle>
        <DialogContent dividers>
  {editLine ? (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField
        label="SKU поставщика"
        size="small"
        value={(editKeys ? (editLine[editKeys.sku] ?? '') : (editLine.supplier_sku ?? ''))}
        onChange={(e) => {
          const v = e.target.value;
          setEditLine((p: any) => {
            if (!p) return p;
            const k = editKeys?.sku || 'supplier_sku';
            return { ...p, [k]: v };
          });
        }}
      />

      <TextField
        label="Цена"
        size="small"
        type="number"
        value={(editKeys ? (editLine[editKeys.price] ?? '') : (editLine.price ?? ''))}
        onChange={(e) => {
          const v = e.target.value;
          setEditLine((p: any) => {
            if (!p) return p;
            const k = editKeys?.price || 'price';
            return { ...p, [k]: v };
          });
        }}
      />

      <TextField
        label="Срок, дней"
        size="small"
        type="number"
        value={(editKeys ? (editLine[editKeys.lead] ?? '') : (editLine.lead_time_days ?? ''))}
        onChange={(e) => {
          const v = e.target.value;
          setEditLine((p: any) => {
            if (!p) return p;
            const k = editKeys?.lead || 'lead_time_days';
            return { ...p, [k]: v };
          });
        }}
      />

      <TextField
        label="Мин. партия (MOQ)"
        size="small"
        type="number"
        value={(editKeys ? (editLine[editKeys.moq] ?? '') : (editLine.min_quantity ?? ''))}
        onChange={(e) => {
          const v = e.target.value;
          setEditLine((p: any) => {
            if (!p) return p;
            const k = editKeys?.moq || 'min_quantity';
            return { ...p, [k]: v };
          });
        }}
      />

      <TextField
        label="Упаковка (шт)"
        size="small"
        type="number"
        value={(editKeys ? (editLine[editKeys.pack] ?? '') : (editLine.package_quantity ?? ''))}
        onChange={(e) => {
          const v = e.target.value;
          setEditLine((p: any) => {
            if (!p) return p;
            const k = editKeys?.pack || 'package_quantity';
            return { ...p, [k]: v };
          });
        }}
      />

      <TextField
        label="Шаг (шт)"
        size="small"
        type="number"
        value={(editKeys ? (editLine[editKeys.step] ?? '') : (editLine.quantity_step ?? ''))}
        onChange={(e) => {
          const v = e.target.value;
          setEditLine((p: any) => {
            if (!p) return p;
            const k = editKeys?.step || 'quantity_step';
            return { ...p, [k]: v };
          });
        }}
      />
    </Stack>
  ) : null}
</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{ textTransform: 'none' }}
            disabled={!editLine || saveLineMut.isPending}
            onClick={() => {
              if (!editLine) return;
              const k = editKeys || deriveEditKeys(editLine);
              const payload: any = {
                id: editLine.id,
                [k.sku]: editLine[k.sku] ?? null,
                [k.price]: toNumOrNull(editLine[k.price]),
                [k.lead]: toNumOrNull(editLine[k.lead]),
                [k.moq]: toNumOrNull(editLine[k.moq]),
                [k.pack]: toNumOrNull(editLine[k.pack]),
                [k.step]: toNumOrNull(editLine[k.step]),
              };
              saveLineMut.mutate(payload);}}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
