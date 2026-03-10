/**
 * Purchase Orders page (snab)
 *
 * UX:
 * - /po: реестр заказов поставщикам
 * - /po?order_id=<id>: карточка заказа (просмотр/редактирование)
 *
 * Includes shipments split (deliveries/parties) for one PO:
 * - create shipment with ETA+address
 * - distribute shipment quantities by PO lines (cannot exceed ordered qty)
 */
import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { http, fixPath } from '../api/_http';
import StatusChip, { getStatusLabel } from '../components/StatusChip';

type PurchaseOrderLine = {
  id: number;
  item: number;
  item_sku?: string;
  item_name?: string;
  qty: any;
  price: any;
  status?: string;
  is_blocked?: boolean | null;
};

type PurchaseOrder = {
  id: number;
  number: string;
  supplier: number;
  supplier_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
  purchase_request_id?: number | null;
  project_name?: string | null;
  stage_name?: string | null;
  deadline?: string | null;
  planned_delivery_date?: string | null;
  delivery_address?: string | null;
  sent_at?: string | null;
  lines?: PurchaseOrderLine[];
};

type ShipmentLine = {
  id: number;
  order_line_id: number;
  item_name?: string;
  ordered_qty?: any;
  qty: any;
};

type Shipment = {
  id: number;
  order_id: number;
  order_number: string;
  supplier_name: string;
  number: string;
  status: string;
  eta_date?: string | null;
  delivered_at?: string | null;
  address?: string | null;
  notes?: string | null;
  lines?: ShipmentLine[];
};

// Статусы отображаем единообразно через общий компонент StatusChip

function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(v?: string | null) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function fmtDateOnly(v?: string | null) {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderIdParamRaw = searchParams.get('order_id');
  const orderIdParam = orderIdParamRaw ? Number(orderIdParamRaw) : null;

  const prFilterRaw =
    searchParams.get('purchase_request_id') ||
    searchParams.get('purchase_request') ||
    searchParams.get('pr_id');
  const prFilter = prFilterRaw ? Number(prFilterRaw) : null;

  const goList = React.useCallback(() => {
    const p: Record<string, string> = {};
    if (prFilterRaw) p.purchase_request_id = String(prFilterRaw);
    setSearchParams(p);
  }, [prFilterRaw, setSearchParams]);

  const openOrder = React.useCallback(
    (id: number) => {
      const p: Record<string, string> = { order_id: String(id) };
      if (prFilterRaw) p.purchase_request_id = String(prFilterRaw);
      setSearchParams(p);
    },
    [prFilterRaw, setSearchParams]
  );

  const clearFilter = React.useCallback(() => setSearchParams({}), [setSearchParams]);

  const ordersQ = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders', prFilterRaw || 'all'],
    queryFn: async () => {
      const res = await http.get(fixPath('/api/procurement/purchase-orders/'));
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });


const [qText, setQText] = React.useState('');
const [statusFilter, setStatusFilter] = React.useState<string>('all');
const STORAGE_KEY_COMPLETED = "snab.purchase_orders.showCompleted";
const [showCompleted, setShowCompleted] = React.useState<boolean>(() => {
  try {
    return localStorage.getItem(STORAGE_KEY_COMPLETED) === "1";
  } catch {
    return false;
  }
});
React.useEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY_COMPLETED, showCompleted ? "1" : "0");
  } catch {
    // ignore
  }
}, [showCompleted]);


const filteredOrders = React.useMemo(() => {
  const list = ordersQ.data || [];
  const q = qText.trim().toLowerCase();
  return list.filter((o) => {
    if (prFilter && Number(o.purchase_request_id || 0) !== prFilter) return false;
    const st = (o.status || '').toLowerCase();
    if (statusFilter !== 'all' && st !== statusFilter) return false;
    if (statusFilter === 'all' && !showCompleted && (st === 'delivered' || st === 'closed' || st === 'cancelled')) return false;
    if (!q) return true;
    const hay = `${o.number} ${o.supplier_name || ''} ${o.project_name || ''} ${o.stage_name || ''}`.toLowerCase();
    return hay.includes(q);
  });
}, [ordersQ.data, qText, statusFilter, showCompleted, prFilter]);

const scopeCount = React.useMemo(() => {
  const list = ordersQ.data || [];
  if (!prFilter) return list.length;
  return list.filter((o) => Number(o.purchase_request_id || 0) === prFilter).length;
}, [ordersQ.data, prFilter]);

  const detailId = orderIdParam;

  const orderDetailQ = useQuery<PurchaseOrder | null>({
    queryKey: ['purchase-order', detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await http.get(fixPath(`/api/procurement/purchase-orders/${detailId}/`));
      return res.data;
    },
  });

  const shipmentsQ = useQuery<Shipment[]>({
    queryKey: ['shipments', detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await http.get(fixPath(`/api/procurement/shipments/?order=${detailId}`));
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const shipments: Shipment[] = shipmentsQ.data || [];

  const deleteMut = useMutation({
    mutationFn: (id: number) => http.delete(fixPath(`/api/procurement/purchase-orders/${id}/`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['purchase-order'] });
      goList();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || 'Не удалось удалить заказ.';
      // eslint-disable-next-line no-alert
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const updateOrderMut = useMutation({
    mutationFn: (payload: {
      id: number;
      deadline: string | null;
      planned_delivery_date: string | null;
      delivery_address: string | null;
    }) =>
      http.patch(fixPath(`/api/procurement/purchase-orders/${payload.id}/`), {
        deadline: payload.deadline,
        planned_delivery_date: payload.planned_delivery_date,
        delivery_address: payload.delivery_address,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['purchase-order', detailId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || 'Не удалось сохранить реквизиты заказа.';
      // eslint-disable-next-line no-alert
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const sendOrderMut = useMutation({
    mutationFn: (id: number) => http.post(fixPath(`/api/procurement/purchase-orders/${id}/send/`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['purchase-order', detailId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data ||
        err?.message ||
        'Не удалось отправить заказ поставщику.';
      // eslint-disable-next-line no-alert
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const updateLineMut = useMutation({
    mutationFn: (payload: { id: number; qty?: any; price?: any; is_blocked?: boolean }) =>
      http.patch(fixPath(`/api/procurement/purchase-order-lines/${payload.id}/`), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['purchase-order', detailId] });
      if (detailId) qc.invalidateQueries({ queryKey: ['shipments', detailId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data ||
        err?.message ||
        'Не удалось сохранить строку заказа.';
      // eslint-disable-next-line no-alert
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const createShipmentMut = useMutation({
    mutationFn: (payload: { order: number; eta_date: string | null; address: string | null; notes?: string | null }) =>
      http.post(fixPath('/api/procurement/shipments/'), payload),
    // ВАЖНО: навигацию делаем только после set_lines, иначе доставка открывается без состава партии.
    onSuccess: () => {
      if (detailId) qc.invalidateQueries({ queryKey: ['shipments', detailId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || 'Не удалось создать доставку.';
      // eslint-disable-next-line no-alert
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const setShipmentLinesMut = useMutation({
    mutationFn: (payload: { shipmentId: number; lines: Array<{ order_line_id: number; qty: any }> }) =>
      http.post(fixPath(`/api/procurement/shipments/${payload.shipmentId}/set_lines/`), { lines: payload.lines }),
    onSuccess: () => {
      if (detailId) qc.invalidateQueries({ queryKey: ['shipments', detailId] });
      if (detailId) qc.invalidateQueries({ queryKey: ['purchase-order', detailId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data ||
        err?.message ||
        'Не удалось сохранить строки доставки.';
      // eslint-disable-next-line no-alert
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const deleteShipmentMut = useMutation({
    mutationFn: (shipmentId: number) => http.delete(fixPath(`/api/procurement/shipments/${shipmentId}/`)),
    onSuccess: () => {
      if (detailId) qc.invalidateQueries({ queryKey: ['shipments', detailId] });
      if (detailId) qc.invalidateQueries({ queryKey: ['purchase-order', detailId] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  const orderDetail = orderDetailQ.data;

  const [editDeadline, setEditDeadline] = React.useState('');
  const [editPlannedDelivery, setEditPlannedDelivery] = React.useState('');
  const [editDeliveryAddress, setEditDeliveryAddress] = React.useState('');

  const [lineEdits, setLineEdits] = React.useState<Record<number, { qty: any; price: any; is_blocked: boolean }>>({});

  React.useEffect(() => {
    if (!orderDetail) return;

    setEditDeadline((orderDetail.deadline || '')?.slice(0, 10));
    setEditPlannedDelivery((orderDetail.planned_delivery_date || '')?.slice(0, 10));
    setEditDeliveryAddress(orderDetail.delivery_address || '');

    const next: Record<number, { qty: any; price: any; is_blocked: boolean }> = {};
    (orderDetail.lines || []).forEach((ln) => {
      next[ln.id] = {
        qty: ln.qty,
        price: ln.price,
        is_blocked: !!ln.is_blocked,
      };
    });
    setLineEdits(next);
  }, [orderDetail?.id]);

  // Shipments dialogs state
  const [shipmentCreateOpen, setShipmentCreateOpen] = React.useState(false);
  const [shipmentEta, setShipmentEta] = React.useState('');
  const [shipmentAddress, setShipmentAddress] = React.useState('');

  const [shipmentNotes, setShipmentNotes] = React.useState('');
  const [shipmentNewLineEdits, setShipmentNewLineEdits] = React.useState<Record<number, any>>({}); // po_line_id -> qty to deliver


  const [shipmentEditOpen, setShipmentEditOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | null>(null);
  const [shipmentLineEdits, setShipmentLineEdits] = React.useState<Record<number, any>>({}); // po_line_id -> qty

  const openShipmentEdit = (sh: Shipment) => {
    setEditingShipment(sh);
    const map: Record<number, any> = {};
    (sh.lines || []).forEach((ln) => {
      map[ln.order_line_id] = ln.qty;
    });
    setShipmentLineEdits(map);
    setShipmentEditOpen(true);
  };

  const saveShipmentLines = () => {
    if (!editingShipment) return;
    const linesPayload = Object.entries(shipmentLineEdits)
      .map(([k, v]) => ({ order_line_id: Number(k), qty: v }))
      .filter((x) => x.order_line_id && Number(x.qty) > 0);

    setShipmentLinesMut.mutate({ shipmentId: editingShipment.id, lines: linesPayload });
    setShipmentEditOpen(false);
  };
  const allocatedByPoLine = React.useMemo(() => {
    const map: Record<number, number> = {};
    // count allocations from all existing shipments except cancelled
    for (const sh of shipments) {
      if (sh.status === 'cancelled') continue;
      for (const ln of sh.lines || []) {
        const key = Number(ln.order_line_id);
        const v = toNum(ln.qty);
        if (!Number.isFinite(key) || !Number.isFinite(v)) continue;
        map[key] = (map[key] || 0) + v;
      }
    }
    return map;
  }, [shipments]);

  const deliveredByPoLine = React.useMemo(() => {
    const map: Record<number, number> = {};
    for (const sh of shipments) {
      if (sh.status !== 'delivered') continue;
      for (const ln of sh.lines || []) {
        const key = Number(ln.order_line_id);
        const v = toNum(ln.qty);
        if (!Number.isFinite(key) || !Number.isFinite(v)) continue;
        map[key] = (map[key] || 0) + v;
      }
    }
    return map;
  }, [shipments]);

  const orderCoverage = React.useMemo(() => {
    const lines = orderDetail?.lines || [];
    const total = lines.length || 0;

    let covered = 0;
    let fullyDelivered = 0;

    for (const ln of lines) {
      const ordered = toNum(ln.qty);
      const allocated = toNum(allocatedByPoLine[ln.id] || 0);
      const delivered = toNum(deliveredByPoLine[ln.id] || 0);

      if (allocated > 0) covered += 1;

      // qty<=0 считаем закрытым, чтобы не ломать процент
      if (ordered <= 0 || delivered >= ordered - 1e-9) fullyDelivered += 1;
    }

    const holes = Math.max(0, total - covered);
    const closedPct = total > 0 ? Math.round((fullyDelivered / total) * 100) : 0;

    return { total, covered, holes, fullyDelivered, closedPct };
  }, [orderDetail?.id, orderDetail?.lines, allocatedByPoLine, deliveredByPoLine]);


  const buildRowsForNewShipment = React.useCallback(() => {
    const rows = (orderDetail?.lines || []).map((ln, idx) => {
      const ordered = toNum(ln.qty);
      const allocated = Number(allocatedByPoLine[ln.id] || 0);
      const remaining = Math.max(0, (Number.isFinite(ordered) ? ordered : 0) - (Number.isFinite(allocated) ? allocated : 0));
      const toDeliverRaw = shipmentNewLineEdits[ln.id];
      const toDeliver = toNum(toDeliverRaw || 0);
      const valid = !toDeliverRaw ? true : (Number.isFinite(toDeliver) && toDeliver > 0 && toDeliver <= remaining + 1e-9);
      return {
        idx,
        poLineId: ln.id,
        name: ln.item_name || ln.item_sku || String(ln.item),
        ordered,
        allocated,
        remaining,
        toDeliverRaw: toDeliverRaw ?? '',
        toDeliver,
        valid,
        isBlocked: !!ln.is_blocked,
      };
    });

    // move selected (toDeliver>0) to top
    rows.sort((a, b) => {
      const sa = a.toDeliver > 0 ? 1 : 0;
      const sb = b.toDeliver > 0 ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return a.idx - b.idx;
    });

    return rows;
  }, [orderDetail?.lines, allocatedByPoLine, shipmentNewLineEdits]);

  const currentQtyByPoLine = React.useMemo(() => {
    const map: Record<number, number> = {};
    if (!editingShipment) return map;
    for (const ln of editingShipment.lines || []) {
      const key = Number(ln.order_line_id);
      const v = Number(ln.qty);
      if (!Number.isFinite(key) || !Number.isFinite(v)) continue;
      map[key] = v;
    }
    return map;
  }, [editingShipment]);

  const buildRowsForEditShipment = React.useCallback(() => {
    const rows = (orderDetail?.lines || []).map((ln, idx) => {
      const ordered = toNum(ln.qty);
      const allocatedAll = Number(allocatedByPoLine[ln.id] || 0); // incl current shipment
      const current = Number(currentQtyByPoLine[ln.id] || 0);
      const allocatedOther = Math.max(0, allocatedAll - current);
      const remaining = Math.max(0, (Number.isFinite(ordered) ? ordered : 0) - (Number.isFinite(allocatedOther) ? allocatedOther : 0));
      const toDeliverRaw = shipmentLineEdits[ln.id];
      const toDeliver = toNum(toDeliverRaw || 0);
      const valid = !toDeliverRaw ? true : (Number.isFinite(toDeliver) && toDeliver >= 0 && toDeliver <= remaining + 1e-9);
      return {
        idx,
        poLineId: ln.id,
        name: ln.item_name || ln.item_sku || String(ln.item),
        ordered,
        allocatedOther,
        remaining,
        toDeliverRaw: toDeliverRaw ?? '',
        toDeliver,
        valid,
        isBlocked: !!ln.is_blocked,
      };
    });

    rows.sort((a, b) => {
      const sa = a.toDeliver > 0 ? 1 : 0;
      const sb = b.toDeliver > 0 ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return a.idx - b.idx;
    });

    return rows;
  }, [orderDetail?.lines, allocatedByPoLine, currentQtyByPoLine, shipmentLineEdits]);


  const editShipmentRows = editingShipment ? buildRowsForEditShipment() : [];
  const editShipmentSelected = editShipmentRows.filter((r) => r.toDeliver > 0);
  const editShipmentHasInvalid = editShipmentSelected.some((r) => !r.valid);
  const canSaveShipmentEdit = !!editingShipment && !editShipmentHasInvalid;

  const canEditOrder = orderDetail?.status === 'draft';

  const sendOrder = async () => {
    if (!orderDetail) return;
    try {
      await updateOrderMut.mutateAsync({
        id: orderDetail.id,
        deadline: editDeadline?.trim() ? editDeadline.trim() : null,
        planned_delivery_date: editPlannedDelivery?.trim() ? editPlannedDelivery.trim() : null,
        delivery_address: editDeliveryAddress?.trim() ? editDeliveryAddress.trim() : null,
      });
      await sendOrderMut.mutateAsync(orderDetail.id);
    } catch {
      // handled by onError
    }
  };

  // Full-screen view
  if (orderIdParam) {
    return (
      <Box p={2}>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button startIcon={<ArrowBackIcon />} onClick={goList}>
                  К списку
                </Button>
                <Typography variant="h6">Заказ поставщику</Typography>
              </Stack>

              {orderDetail ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  {canEditOrder ? (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SendIcon fontSize="small" />}
                      onClick={sendOrder}
                      disabled={!editDeliveryAddress?.trim() || !editPlannedDelivery?.trim()}
                    >
                      Отпр.
                    </Button>
                  ) : null}
                  <StatusChip entity="purchase_order" status={orderDetail.status} />
                </Stack>
              ) : null}
            </Stack>

            {!detailId ? (
              <Typography color="text.secondary">Не выбран заказ.</Typography>
            ) : orderDetailQ.isLoading ? (
              <Box p={2} display="flex" justifyContent="center">
                <CircularProgress />
              </Box>
            ) : orderDetailQ.error ? (
              <Typography color="error">Ошибка загрузки заказа</Typography>
            ) : orderDetail ? (
              <Stack spacing={2}>
                <Typography variant="h5">{orderDetail.number}</Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>Поставщик:</strong> {orderDetail.supplier_name || orderDetail.supplier}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Проект:</strong> {orderDetail.project_name || '—'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Этап:</strong> {orderDetail.stage_name || '—'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Создан:</strong> {fmtDateTime(orderDetail.created_at)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Обновлён:</strong> {fmtDateTime(orderDetail.updated_at)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Отправлен:</strong> {fmtDateTime(orderDetail.sent_at || null)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Stack spacing={1.5}>
                      <TextField
                        label="Дедлайн"
                        type="date"
                        size="small"
                        value={editDeadline || ''}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        disabled={!canEditOrder}
                      />
                      <TextField
                        label="Планируемая дата поставки"
                        type="date"
                        size="small"
                        value={editPlannedDelivery || ''}
                        onChange={(e) => setEditPlannedDelivery(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        disabled={!canEditOrder}
                      />
                      <TextField
                        label="Адрес доставки"
                        value={editDeliveryAddress || ''}
                        onChange={(e) => setEditDeliveryAddress(e.target.value)}
                        multiline
                        minRows={2}
                        disabled={!canEditOrder}
                      />
                      {canEditOrder ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            updateOrderMut.mutate({
                              id: orderDetail.id,
                              deadline: editDeadline?.trim() ? editDeadline.trim() : null,
                              planned_delivery_date: editPlannedDelivery?.trim() ? editPlannedDelivery.trim() : null,
                              delivery_address: editDeliveryAddress?.trim() ? editDeliveryAddress.trim() : null,
                            })
                          }
                        >
                          Сохранить реквизиты
                        </Button>
                      ) : null}
                    </Stack>
                  </Grid>
                </Grid>


                <Card variant="outlined">
                  <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Typography variant="subtitle2">Обеспеченность заказа</Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Tooltip title="Позиции, полностью закрытые доставками со статусом «Доставлено».">
                          <Chip
                            size="small"
                            color={
                              orderCoverage.total > 0 && orderCoverage.fullyDelivered === orderCoverage.total ? 'success' : 'default'
                            }
                            label={`Закрыто: ${orderCoverage.fullyDelivered}/${orderCoverage.total} (${orderCoverage.closedPct}%)`}
                          />
                        </Tooltip>
                        <Tooltip title="Позиции, включённые хотя бы в одну доставку (кроме «Отменено»).">
                          <Chip size="small" label={`Покрыто: ${orderCoverage.covered}/${orderCoverage.total}`} />
                        </Tooltip>
                        <Tooltip title="Позиции, которые ещё не распределены ни в одну доставку. Это основная «дыра» в обеспечении.">
                          <Chip
                            size="small"
                            color={orderCoverage.holes > 0 ? 'warning' : 'default'}
                            label={`Без доставок: ${orderCoverage.holes}`}
                          />
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Divider />

                <Typography variant="subtitle1">Строки заказа</Typography>

                <TableContainer component={Paper} variant="outlined">
                  {orderDetail.lines?.length ? (
                    <Table size="small" sx={{ '& th, & td': { px: 1, py: 0.75 } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Номенклатура</TableCell>
                          <TableCell align="right" sx={{ width: 120 }}>Заказано</TableCell>
                          <TableCell align="right" sx={{ width: 140 }}>В доставках</TableCell>
                          <TableCell align="right" sx={{ width: 120 }}>Остаток</TableCell>
                          <TableCell align="right" sx={{ width: 160 }}>
                            Цена
                          </TableCell>
                          <TableCell align="center" sx={{ width: 70 }}>
                            Блок
                          </TableCell>
                          <TableCell align="right" sx={{ width: 120 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {orderDetail.lines.map((ln) => {
                          const e = lineEdits[ln.id] || { qty: ln.qty, price: ln.price, is_blocked: !!ln.is_blocked };
                          const blocked = !!e.is_blocked;

                          const ordered = toNum(ln.qty);
                          const allocated = toNum(allocatedByPoLine[ln.id] || 0);
                          const delivered = toNum(deliveredByPoLine[ln.id] || 0);
                          const remaining = Math.max(0, ordered - allocated);
                          const isHole = allocated <= 0;
                          const isClosed = ordered > 0 && delivered >= ordered;

                          return (
                            <TableRow key={ln.id} hover>
                              <TableCell sx={{ minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={String(ln.item_name || ln.item_sku || ln.item || '')}
                                  >
                                    {ln.item_name || ln.item_sku || ln.item}
                                  </Typography>
                                  {isHole ? (
                                    <Tooltip title="Эта позиция ещё не распределена ни в одну доставку (узкое место).">
                                      <Chip size="small" color="warning" variant="outlined" label="Без доставки" />
                                    </Tooltip>
                                  ) : isClosed ? (
                                    <Tooltip title="Позиция полностью закрыта доставками со статусом «Доставлено».">
                                      <Chip size="small" color="success" variant="outlined" label="Закрыто" />
                                    </Tooltip>
                                  ) : (
                                    <Tooltip
                                      title={
                                        delivered > 0
                                          ? `Позиция частично доставлена (${delivered} из ${ordered}).`
                                          : 'По позиции уже оформлена доставка, но она ещё не закрыта полностью.'
                                      }
                                    >
                                      <Chip
                                        size="small"
                                        color="info"
                                        variant="outlined"
                                        label={delivered > 0 ? 'Частично доставлено' : 'В доставке'}
                                      />
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>

                              <TableCell align="right">
                                {canEditOrder && !blocked ? (
                                  <TextField
                                    size="small"
                                    value={e.qty ?? ''}
                                    onChange={(ev) =>
                                      setLineEdits((prev) => ({
                                        ...prev,
                                        [ln.id]: { ...(prev[ln.id] || { qty: ln.qty, price: ln.price, is_blocked: !!ln.is_blocked }), qty: ev.target.value },
                                      }))
                                    }
                                    inputProps={{ style: { textAlign: 'right' } }}
                                  />
                                ) : (
                                  ln.qty
                                )}
                              </TableCell>

                              <TableCell align="right">
                                <Stack spacing={0} alignItems="flex-end">
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {allocated}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    дост: {delivered}
                                  </Typography>
                                </Stack>
                              </TableCell>

                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {remaining}
                                </Typography>
                              </TableCell>

                              <TableCell align="right">
                                {canEditOrder && !blocked ? (
                                  <TextField
                                    size="small"
                                    value={e.price ?? ''}
                                    onChange={(ev) =>
                                      setLineEdits((prev) => ({
                                        ...prev,
                                        [ln.id]: { ...(prev[ln.id] || { qty: ln.qty, price: ln.price, is_blocked: !!ln.is_blocked }), price: ev.target.value },
                                      }))
                                    }
                                    inputProps={{ style: { textAlign: 'right' } }}
                                  />
                                ) : (
                                  ln.price
                                )}
                              </TableCell>

                              <TableCell align="center">
                                <Tooltip title={blocked ? 'Разблокировать строку' : 'Заблокировать строку'}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        if (!canEditOrder) return;
                                        const next = !blocked;
                                        setLineEdits((prev) => ({ ...prev, [ln.id]: { ...e, is_blocked: next } }));
                                        updateLineMut.mutate({ id: ln.id, is_blocked: next });
                                      }}
                                      disabled={!canEditOrder}
                                    >
                                      {blocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </TableCell>

                              <TableCell align="right">
                                {canEditOrder && !blocked ? (
                                  <Button size="small" variant="outlined" onClick={() => updateLineMut.mutate({ id: ln.id, qty: e.qty, price: e.price })}>
                                    Сохранить
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <Box p={2}>
                      <Typography variant="body2" color="text.secondary">
                        Нет строк
                      </Typography>
                    </Box>
                  )}
                </TableContainer>
                {shipments.length > 0 ? (
                  <Box display="flex" justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => navigate(fixPath('/shipments'))}>
                      К списку доставок
                    </Button>
                  </Box>
                ) : null}


                <Divider />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">Доставки (партии)</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => {
                      setShipmentEta(editPlannedDelivery || '');
                      setShipmentAddress(editDeliveryAddress || '');
                      setShipmentNotes('');
                      setShipmentNewLineEdits({});
                      setShipmentCreateOpen(true);
                    }}
                    disabled={!orderDetail || orderDetail.status === 'draft'}
                  >
                    Добавить доставку
                  </Button>
                </Stack>

                {orderDetail.status === 'draft' ? (
                  <Typography variant="body2" color="text.secondary">
                    Доставки создаются после отправки заказа (Отпр.).
                  </Typography>
                ) : shipmentsQ.isLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    Загрузка доставок…
                  </Typography>
                ) : shipments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Доставок пока нет. Создайте одну или несколько партий с разными датами.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" sx={{ '& th, & td': { px: 1, py: 0.75 } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 140 }}>№</TableCell>
                          <TableCell sx={{ width: 140 }}>План</TableCell>
                          <TableCell sx={{ width: 140 }}>Статус</TableCell>
                          <TableCell sx={{ width: 260 }}>Комментарий</TableCell>
                          <TableCell>Адрес</TableCell>
                          <TableCell align="right" sx={{ width: 260 }}>
                            Действия
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shipments.map((sh) => (
                          <TableRow key={sh.id} hover>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                              {sh.number || `D-${sh.id}`}
                            </TableCell>
                            <TableCell>{fmtDateOnly(sh.eta_date || null)}</TableCell>
                            <TableCell>
                              <StatusChip entity="shipment" status={sh.status} compact />
                            </TableCell>
                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sh.notes || ''}>
                              {sh.notes || '—'}
                            </TableCell>
                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sh.address || ''}>
                              {sh.address || '—'}
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button size="small" variant="contained" onClick={() => navigate(`/shipments/${encodeURIComponent(String(sh.id))}`)}>
                                  Открыть
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<EditIcon fontSize="small" />} onClick={() => openShipmentEdit(sh)}>
                                  Разбить
                                </Button>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    if (!confirm(`Удалить доставку ${sh.number || sh.id}?`)) return;
                                    deleteShipmentMut.mutate(sh.id);
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <Divider />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Удаление заказа доступно здесь для демо.
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon fontSize="small" />}
                    onClick={() => {
                      if (!orderDetail) return;
                      if (!confirm(`Удалить заказ ${orderDetail.number}?`)) return;
                      deleteMut.mutate(orderDetail.id);
                    }}
                  >
                    Удалить заказ
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Typography color="text.secondary">Не удалось загрузить заказ</Typography>
            )}

            {/* Create shipment dialog */}
            <Dialog open={shipmentCreateOpen} onClose={() => setShipmentCreateOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Оформить частичную доставку</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="План. дата поставки"
                        type="date"
                        value={shipmentEta || ''}
                        onChange={(e) => setShipmentEta(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <TextField
                        label="Адрес доставки"
                        value={shipmentAddress || ''}
                        onChange={(e) => setShipmentAddress(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                      />
                    </Grid>
                  </Grid>

                  <TextField
                    label="Комментарий (опц.)"
                    value={shipmentNotes || ''}
                    onChange={(e) => setShipmentNotes(e.target.value)}
                    fullWidth
                  />

                  {(() => {
                    const rows = buildRowsForNewShipment();
                    const selected = rows.filter((r) => r.toDeliver > 0);
                    const hasInvalid = selected.some((r) => !r.valid);
                    const canSubmit = !!shipmentEta?.trim() && !!shipmentAddress?.trim() && selected.length > 0 && !hasInvalid;

                    return (
                      <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                          Укажите «Кол-во на доставку». Нельзя больше, чем (Кол-во в заказе − Кол-во заказано уже).
                          Как только значение &gt; 0 — строка поднимается вверх.
                        </Typography>

                        <Paper variant="outlined">
                          <Table size="small" sx={{ '& th, & td': { px: 1, py: 0.75 } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell>Наименование</TableCell>
                                <TableCell align="right" sx={{ width: 150 }}>Кол-во в заказе</TableCell>
                                <TableCell align="right" sx={{ width: 160 }}>Кол-во заказано уже</TableCell>
                                <TableCell align="right" sx={{ width: 190 }}>Кол-во на доставку</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {rows.map((r) => {
                                const disabled = r.isBlocked || r.remaining <= 0;
                                const showError = r.toDeliver > 0 && !r.valid;
                                return (
                                  <TableRow key={r.poLineId} hover>
                                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                                      {r.name}{r.isBlocked ? ' (блок)' : ''}
                                    </TableCell>
                                    <TableCell align="right">{Number.isFinite(r.ordered) ? r.ordered : '—'}</TableCell>
                                    <TableCell align="right">{Number.isFinite(r.allocated) ? r.allocated : 0}</TableCell>
                                    <TableCell align="right">
                                      <TextField
                                        size="small"
                                        value={r.toDeliverRaw}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setShipmentNewLineEdits((prev) => ({ ...prev, [r.poLineId]: v }));
                                        }}
                                        placeholder="0"
                                        disabled={disabled}
                                        error={showError}
                                        helperText={
                                          showError
                                            ? `Макс: ${r.remaining}`
                                            : disabled
                                              ? (r.isBlocked ? 'Строка заблокирована' : 'Остаток = 0')
                                              : `Остаток: ${r.remaining}`
                                        }
                                        inputProps={{ style: { textAlign: 'right' } }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Paper>

                        <Divider />

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="text.secondary">
                            Выбрано строк: {selected.length}{hasInvalid ? ' (есть ошибки)' : ''}
                          </Typography>

                          <Button
                            variant="contained"
                            disabled={!canSubmit}
                            onClick={async () => {
                              try {
                                if (!orderDetail) return;

                                const selectedLines = rows
                                  .filter((r) => r.toDeliver > 0 && r.valid)
                                  .map((r) => ({ order_line_id: r.poLineId, qty: r.toDeliver }));

                                const res = await createShipmentMut.mutateAsync({
                                  order: orderDetail.id,
                                  eta_date: shipmentEta?.trim() ? shipmentEta.trim() : null,
                                  address: shipmentAddress?.trim() ? shipmentAddress.trim() : null,
                                  notes: shipmentNotes?.trim() ? shipmentNotes.trim() : null,
                                } as any);

                                const shipmentId =
                                  res?.data?.id ??
                                  res?.data?.shipment_id ??
                                  res?.data?.shipment?.id ??
                                  res?.id ??
                                  null;
                                if (!shipmentId) throw new Error('Shipment id not returned');

                                await setShipmentLinesMut.mutateAsync({ shipmentId, lines: selectedLines });

                                setShipmentCreateOpen(false);
                                setShipmentNewLineEdits({});
                                setShipmentNotes('');

                                // Теперь можно открыть доставку (состав уже сохранён)
                                navigate(`/shipments/${encodeURIComponent(String(shipmentId))}`);
                              } catch (e) {
                                // errors are shown via onError
                              }
                            }}
                          >
                            Оформить доставку
                          </Button>
                        </Stack>
                      </Stack>
                    );
                  })()}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShipmentCreateOpen(false)}>Закрыть</Button>
              </DialogActions>
            </Dialog>

            {/* Edit shipment lines dialog */}
            <Dialog open={shipmentEditOpen} onClose={() => setShipmentEditOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Разбить доставку по позициям</DialogTitle>
              <DialogContent>
                {!editingShipment ? (
                  <Typography color="text.secondary">Не выбрана доставка.</Typography>
                ) : (
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Укажите количества по строкам заказа для этой партии. Нельзя больше остатка (Заказано − Уже распределено в других партиях).
                      Строки с количеством &gt; 0 автоматически поднимаются вверх.
                    </Typography>

                    <Table size="small" sx={{ '& th, & td': { px: 1, py: 0.75 } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Номенклатура</TableCell>
                          <TableCell align="right" sx={{ width: 140 }}>
                            Заказано
                          </TableCell>
                          <TableCell align="right" sx={{ width: 160 }}>Уже распределено</TableCell>
                          <TableCell align="right" sx={{ width: 150 }}>Остаток</TableCell>
                          <TableCell align="right" sx={{ width: 170 }}>В этой партии</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {editShipmentRows.map((r) => {
                          const disabled = r.isBlocked;
                          const showError = r.toDeliver > 0 && !r.valid;
                          return (
                            <TableRow key={r.poLineId} hover>
                              <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                                {r.name}{r.isBlocked ? ' (блок)' : ''}
                              </TableCell>
                              <TableCell align="right">{Number.isFinite(r.ordered) ? r.ordered : '—'}</TableCell>
                              <TableCell align="right">{Number.isFinite(r.allocatedOther) ? r.allocatedOther : 0}</TableCell>
                              <TableCell align="right">{Number.isFinite(r.remaining) ? r.remaining : 0}</TableCell>
                              <TableCell align="right">
                                <TextField
                                  size="small"
                                  value={r.toDeliverRaw}
                                  onChange={(e) =>
                                    setShipmentLineEdits((prev) => ({
                                      ...prev,
                                      [r.poLineId]: e.target.value,
                                    }))
                                  }
                                  disabled={disabled}
                                  error={showError}
                                  helperText={
                                    showError
                                      ? `Макс: ${r.remaining}`
                                      : disabled
                                        ? 'Строка заблокирована'
                                        : (r.remaining <= 0 ? 'Остаток = 0' : `Макс: ${r.remaining}`)
                                  }
                                  inputProps={{ style: { textAlign: 'right' } }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <Typography variant="body2" color={editShipmentHasInvalid ? 'error' : 'text.secondary'}>
                      Выбрано строк: {editShipmentSelected.length}{editShipmentHasInvalid ? ' (есть ошибки)' : ''}
                    </Typography>
                  </Stack>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShipmentEditOpen(false)}>Отмена</Button>
                <Button variant="contained" onClick={saveShipmentLines} disabled={!canSaveShipmentEdit}>
                  Сохранить
                </Button>
              </DialogActions>
            </Dialog>
          </CardContent>
        </Card>
      </Box>
    );
  }


  // List view
  return (
    <Box p={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="h5">Заказы поставщикам</Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <TextField
            size="small"
            label="Поиск (номер / поставщик / проект / этап)"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 360 } }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="po-status-filter-label">Статус</InputLabel>
            <Select
              labelId="po-status-filter-label"
              label="Статус"
              value={statusFilter}
              onChange={(e) => setStatusFilter(String(e.target.value))}
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="draft">{getStatusLabel('purchase_order', 'draft')}</MenuItem>
              <MenuItem value="sent">{getStatusLabel('purchase_order', 'sent')}</MenuItem>
              <MenuItem value="confirmed">{getStatusLabel('purchase_order', 'confirmed')}</MenuItem>
              <MenuItem value="paid">{getStatusLabel('purchase_order', 'paid')}</MenuItem>
              <MenuItem value="in_transit">{getStatusLabel('purchase_order', 'in_transit')}</MenuItem>
              <MenuItem value="delivered">{getStatusLabel('purchase_order', 'delivered')}</MenuItem>
              <MenuItem value="closed">{getStatusLabel('purchase_order', 'closed')}</MenuItem>
              <MenuItem value="cancelled">{getStatusLabel('purchase_order', 'cancelled')}</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            sx={{ ml: 0.5, userSelect: 'none' }}
            control={<Checkbox checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />}
            label={<Typography variant="body2">Показывать завершённые</Typography>}
          />
        </Stack>
      </Stack>

      <Paper>
        {ordersQ.isLoading ? (
          <Box p={2} display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
        ) : ordersQ.error ? (
          <Box p={2}>
            <Typography color="error">Ошибка загрузки заказов</Typography>
          </Box>
        ) : (
          <>
            <Box px={2} py={1} display="flex" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                {prFilter ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Фильтр: заявка #${prFilter}`}
                    onDelete={clearFilter}
                  />
                ) : null}
                <Typography variant="body2" color="text.secondary">
                  Показано: {filteredOrders.length} / {scopeCount}
                </Typography>
              </Stack>
            </Box>
            <Divider />
            <TableContainer sx={{ width: '100%', overflowX: 'hidden' }}>
              <Table
                size="small"
                sx={{
                  tableLayout: 'fixed',
                  width: '100%',
                  minWidth: 0,
                  '& th, & td': { px: 1, py: 0.75 },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 110, fontSize: 12 }}>Заказ</TableCell>
                    <TableCell sx={{ width: 180, fontSize: 12 }}>Поставщик</TableCell>
                    <TableCell sx={{ width: 190, fontSize: 12 }}>Проект</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>Этап</TableCell>
                    <TableCell sx={{ width: 150, fontSize: 12 }}>Сроки</TableCell>
                    <TableCell sx={{ width: 180, fontSize: 12 }}>Адрес</TableCell>
                    <TableCell sx={{ width: 120, fontSize: 12 }}>Статус</TableCell>
                    <TableCell align="right" sx={{ width: 70 }} />
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        {prFilter ? (
                            <>
                              <Typography color="text.secondary">По заявке #{prFilter} заказов пока нет.</Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => navigate(fixPath(`/quotes?purchase_request_id=${prFilter}`))}
                                >
                                  КП по заявке
                                </Button>
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => navigate(fixPath(`/pr?purchase_request_id=${prFilter}`))}
                                >
                                  Открыть заявку
                                </Button>
                              </Stack>
                            </>
                          ) : (
                            <Typography color="text.secondary">Ничего не найдено</Typography>
                          )}
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {filteredOrders.map((o) => (
                    <TableRow
                      key={o.id}
                      hover
                      onClick={() => openOrder(o.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontSize: 12 }}>
                        <Button
                          variant="text"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrder(o.id);
                          }}
                          sx={{
                            minWidth: 0,
                            px: 0,
                            textTransform: 'none',
                            fontWeight: 700,
                            lineHeight: 1.2,
                          }}
                        >
                          {o.number}
                        </Button>
                      </TableCell>

                      <TableCell sx={{ fontSize: 12 }}>
                        <Tooltip title={o.supplier_name || String(o.supplier)}>
                          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.supplier_name || String(o.supplier)}
                          </Box>
                        </Tooltip>
                      </TableCell>

                      <TableCell sx={{ fontSize: 12 }}>
                        <Tooltip title={o.project_name || '—'}>
                          <Box
                            sx={{
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                            }}
                          >
                            {o.project_name || '—'}
                          </Box>
                        </Tooltip>
                      </TableCell>

                      <TableCell sx={{ fontSize: 12 }}>
                        <Tooltip title={o.stage_name || '—'}>
                          <Box
                            sx={{
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                            }}
                          >
                            {o.stage_name || '—'}
                          </Box>
                        </Tooltip>
                      </TableCell>

                      <TableCell sx={{ fontSize: 12 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontSize: 12, lineHeight: 1.25 }}>
                            План: {fmtDateOnly(o.planned_delivery_date || null)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25 }}>
                            Дедл: {fmtDateOnly(o.deadline || null)}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell sx={{ fontSize: 12 }}>
                        <Tooltip title={(o.delivery_address || '').trim() || '—'}>
                          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(o.delivery_address || '').trim() || '—'}
                          </Box>
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        <StatusChip entity="purchase_order" status={o.status} compact />
                      </TableCell>

                      <TableCell align="right">
                        <Tooltip title="Удалить заказ">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!confirm(`Удалить заказ ${o.number}?`)) return;
                              deleteMut.mutate(o.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </Box>
  );
}
