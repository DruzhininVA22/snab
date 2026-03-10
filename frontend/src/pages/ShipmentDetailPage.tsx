/**
 * Детали доставки (Shipment).
 *
 * Отдельная страница — чтобы список доставок был компактным и без "двухпанельного" UI.
 */

import * as React from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  DialogContentText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http, fixPath } from '../api/_http';
import StatusChip, { getStatusLabel } from '../components/StatusChip';

type ShipmentStatus = 'planned' | 'in_transit' | 'delivered' | 'cancelled';

type Shipment = {
  id: number;
  short_number?: string | null;
  order_id: number;
  order_number: string;
  purchase_request_id?: number | null;
  supplier_name: string;
  status: ShipmentStatus;
  eta_date?: string | null;
  delivered_at?: string | null;
  address?: string | null;
  notes?: string | null;
  project_name?: string | null;
  stage_name?: string | null;
  request_items_total?: number | null;
  request_items_fulfilled?: number | null;
  request_items_remaining?: number | null;
  request_fulfilled_pct?: number | null;
  shipment_items_count?: number | null;
  shipment_cover_pct?: number | null;
  lines?: Array<{
    id?: number;
    item_name?: string;
    qty?: number;
    order_line_id?: number;
    ordered_qty?: number;
  }>;
  created_at: string;
  updated_at: string;
};

type PurchaseOrderLine = {
  id: number;
  item_name: string;
  qty: number;
  is_blocked?: boolean;
};

type PurchaseOrder = {
  id: number;
  number: string;
  supplier_name?: string;
  status?: string;
  project_name?: string | null;
  stage_name?: string | null;
  planned_delivery_date?: string | null;
  deadline?: string | null;
  delivery_address?: string | null;
  lines: PurchaseOrderLine[];
};

// Статусы отображаем единообразно через общий компонент StatusChip

export default function ShipmentDetailPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams();
  const shipmentId = Number(params.id);

  const [notes, setNotes] = React.useState<string>('');
  const [etaDate, setEtaDate] = React.useState<string>('');

  const [editOpen, setEditOpen] = React.useState<boolean>(false);
  const [lineEdits, setLineEdits] = React.useState<Record<number, string>>({});
  const [detailsDirty, setDetailsDirty] = React.useState<boolean>(false);
  const [dlgOpen, setDlgOpen] = React.useState<boolean>(false);
  const [dlgStatus, setDlgStatus] = React.useState<ShipmentStatus>('in_transit');

  const shipmentQ = useQuery<Shipment>({
    queryKey: ['shipment', shipmentId],
    enabled: Number.isFinite(shipmentId) && shipmentId > 0,
    queryFn: async () => {
      const res = await http.get(fixPath(`/api/procurement/shipments/${shipmentId}/`));
      return res.data as Shipment;
    },
  });

  const shipment = shipmentQ.data;

  React.useEffect(() => {
    setNotes(shipment?.notes || '');
    setEtaDate(shipment?.eta_date || '');
    setDetailsDirty(false);
  }, [shipment?.id]);

  React.useEffect(() => {
    // Пересчитываем "грязность" реквизитов
    if (!shipment) return;
    const d1 = (shipment.notes || '') !== (notes || '');
    const d2 = (shipment.eta_date || '') !== (etaDate || '');
    setDetailsDirty(d1 || d2);
  }, [shipment, notes, etaDate]);

  const orderQ = useQuery<PurchaseOrder>({
    queryKey: ['purchase-order', shipment?.order_id],
    enabled: !!shipment?.order_id,
    queryFn: async () => {
      const res = await http.get(fixPath(`/api/procurement/purchase-orders/${shipment!.order_id}/`));
      return res.data as PurchaseOrder;
    },
  });

  const orderShipmentsQ = useQuery<Shipment[]>({
    queryKey: ['shipments-by-order', shipment?.order_id],
    enabled: !!shipment?.order_id,
    queryFn: async () => {
      const res = await http.get(fixPath(`/api/procurement/shipments/?order=${shipment!.order_id}`));
      return (res.data || []) as Shipment[];
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: (payload: { id: number; status: ShipmentStatus; notes?: string }) =>
      http.post(fixPath(`/api/procurement/shipments/${payload.id}/set_status/`), {
        status: payload.status,
        notes: payload.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] });
      qc.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      setDlgOpen(false);
    },
  });

  const updateDetailsMut = useMutation({
    mutationFn: (payload: { id: number; eta_date?: string | null; address?: string | null; notes?: string | null }) =>
      http.patch(fixPath(`/api/procurement/shipments/${payload.id}/`), {
        eta_date: payload.eta_date,
        address: payload.address,
        notes: payload.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] });
      qc.invalidateQueries({ queryKey: ['shipment', shipmentId] });
    },
  });

  const setLinesMut = useMutation({
    mutationFn: (payload: { id: number; lines: Array<{ order_line_id: number; qty: number }> }) =>
      http.post(fixPath(`/api/procurement/shipments/${payload.id}/set_lines/`), { lines: payload.lines }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] });
      qc.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      qc.invalidateQueries({ queryKey: ['shipments-by-order', shipment?.order_id] });
      setEditOpen(false);
    },
  });

  const handleStatusChange = (status: ShipmentStatus) => {
    setDlgStatus(status);
    setDlgOpen(true);
  };

  const handleConfirmStatusChange = () => {
    if (!shipment) return;
    updateStatusMut.mutate({ id: shipment.id, status: dlgStatus, notes });
  };

  const isFinal = shipment?.status === 'delivered' || shipment?.status === 'cancelled';

  const openEditLines = () => {
    if (!shipment || !orderQ.data) return;
    // предзаполняем edit поля значениями текущей партии
    const currentMap: Record<number, number> = {};
    (shipment.lines || []).forEach((ln) => {
      if (ln.order_line_id && typeof ln.qty === 'number') currentMap[ln.order_line_id] = ln.qty;
    });
    const seed: Record<number, string> = {};
    orderQ.data.lines.forEach((ol) => {
      const v = currentMap[ol.id] ?? 0;
      seed[ol.id] = v > 0 ? String(v) : '';
    });
    setLineEdits(seed);
    setEditOpen(true);
  };

  const buildEditRows = () => {
    const order = orderQ.data;
    if (!shipment || !order) return [] as Array<any>;

    const shipments = orderShipmentsQ.data || [];
    // total per order_line across OTHER shipments excluding cancelled
    const allocatedOther: Record<number, number> = {};
    for (const sh of shipments) {
      if (sh.id === shipment.id) continue;
      if (sh.status === 'cancelled') continue;
      for (const ln of sh.lines || []) {
        const olId = ln.order_line_id;
        const qty = typeof ln.qty === 'number' ? ln.qty : 0;
        if (!olId || qty <= 0) continue;
        allocatedOther[olId] = (allocatedOther[olId] || 0) + qty;
      }
    }

    const rows = order.lines.map((ol) => {
      const raw = (lineEdits[ol.id] ?? '').trim();
      const toDeliver = raw ? Number(raw.replace(',', '.')) : 0;
      const ordered = Number(ol.qty || 0);
      const other = Number(allocatedOther[ol.id] || 0);
      const max = Math.max(ordered - other, 0);
      const valid = !(toDeliver > max + 1e-9);
      return {
        poLineId: ol.id,
        name: ol.item_name,
        ordered,
        allocatedOther: other,
        max,
        toDeliver,
        toDeliverRaw: raw,
        isBlocked: !!ol.is_blocked,
        valid,
      };
    });

    // строки с qty > 0 наверх
    rows.sort((a, b) => {
      const aa = a.toDeliver > 0 ? 1 : 0;
      const bb = b.toDeliver > 0 ? 1 : 0;
      return bb - aa;
    });
    return rows;
  };

  if (!Number.isFinite(shipmentId) || shipmentId <= 0) {
    return (
      <Box p={2}>
        <Typography color="error">Некорректный идентификатор доставки</Typography>
        <Box mt={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/shipments')}>
            К списку доставок
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/shipments')}
            variant="text"
          >
            Доставки
          </Button>
          <Typography variant="h5">
            Доставка {shipment?.short_number || `D-${shipmentId}`}
          </Typography>
        </Stack>

        {shipment && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant="outlined" onClick={() => navigate(fixPath(`/po?order_id=${shipment.order_id}`))}>
              Открыть заказ
            </Button>
            {shipment.purchase_request_id ? (
              <Button size="small" variant="outlined" onClick={() => navigate(fixPath(`/pr?purchase_request_id=${shipment.purchase_request_id}`))}>
                Открыть заявку
              </Button>
            ) : null}
            <StatusChip entity="shipment" status={shipment.status} />
          </Stack>
        )}
      </Stack>

      <Card>
        <CardContent>
          {shipmentQ.isLoading ? (
            <Box p={2} display="flex" justifyContent="center">
              <CircularProgress />
            </Box>
          ) : shipmentQ.isError ? (
            <Typography color="error">Не удалось загрузить доставку</Typography>
          ) : shipment ? (
            <Stack spacing={2}>
              {/* Реквизиты */}
              <Stack spacing={1}>
                <Typography variant="subtitle2">Реквизиты</Typography>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Stack flex={1} spacing={1}>
                    <Typography variant="body2">
                      <strong>Заказ:</strong>{' '}
                      <a href={`/po?order_id=${encodeURIComponent(String(shipment.order_id))}`}>{shipment.order_number}</a>
                    </Typography>
                    <Typography variant="body2">
                      <strong>Заявка:</strong>{' '}
                      {shipment.purchase_request_id ? (
                        <a href={fixPath(`/pr?purchase_request_id=${shipment.purchase_request_id}`)}>
                          #{shipment.purchase_request_id}
                        </a>
                      ) : (
                        '—'
                      )}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Поставщик:</strong> {shipment.supplier_name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Проект:</strong> {shipment.project_name || '—'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Этап:</strong> {shipment.stage_name || '—'}
                    </Typography>
                    {shipment.delivered_at && (
                      <Typography variant="body2">
                        <strong>Факт. дата:</strong> {shipment.delivered_at}
                      </Typography>
                    )}
                  </Stack>

                  <Stack flex={1} spacing={1}>
                    <TextField
                      label="План. дата"
                      value={etaDate}
                      onChange={(e) => setEtaDate(e.target.value)}
                      size="small"
                      disabled={!!isFinal}
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                    <Typography variant="body2">
                      <strong>Адрес доставки:</strong> {shipment.address || '—'}
                    </Typography>
                    <TextField
                      label="Комментарий"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      size="small"
                      disabled={!!isFinal}
                      multiline
                      minRows={2}
                    />

                    {!isFinal && (
                      <Stack direction="row" justifyContent="flex-end">
                        <Button
                          variant="contained"
                          disabled={!detailsDirty || updateDetailsMut.isPending}
                          onClick={() => {
                            updateDetailsMut.mutate({
                              id: shipment.id,
                              eta_date: etaDate?.trim() ? etaDate.trim() : null,
                                  notes: notes?.trim() ? notes.trim() : null,
                            });
                          }}
                        >
                          Сохранить реквизиты
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              </Stack>

              {(typeof shipment.request_items_total === 'number' && shipment.request_items_total > 0) && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2">Прогресс заявки</Typography>
                  <Typography variant="body2">
                    <strong>Выполнено:</strong> {shipment.request_items_fulfilled ?? 0}/{shipment.request_items_total}
                    {typeof shipment.request_fulfilled_pct === 'number' ? ` (${shipment.request_fulfilled_pct}%)` : ''}
                    {typeof shipment.request_items_remaining === 'number' ? `, осталось ${shipment.request_items_remaining}` : ''}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Доля этой доставки:</strong> {shipment.shipment_items_count ?? 0}/{shipment.request_items_total}
                    {typeof shipment.shipment_cover_pct === 'number' ? ` (${shipment.shipment_cover_pct}%)` : ''}
                  </Typography>
                </>
              )}

              <Divider sx={{ my: 1 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Состав партии</Typography>
                {!isFinal && (
                  <Button size="small" variant="outlined" onClick={openEditLines}>
                    Изменить состав
                  </Button>
                )}
              </Stack>

              {Array.isArray(shipment.lines) && shipment.lines.length > 0 ? (
                <Paper variant="outlined">
                  <Table size="small" sx={{ '& th, & td': { px: 1, py: 0.75 } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Номенклатура</TableCell>
                        <TableCell align="right" sx={{ width: 140 }}>Кол-во</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shipment.lines.map((ln, idx) => {
                        const name = ln.item_name || `Строка ${idx + 1}`;
                        const qty = (ln.qty ?? 0) as number;
                        return (
                          <TableRow key={(ln.id ?? idx) as any} hover>
                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                              {name}
                            </TableCell>
                            <TableCell align="right">{qty}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Строки партии не заданы. Добавьте позиции (qty &gt; 0).
                </Typography>
              )}

              <Divider sx={{ my: 1 }} />

              {shipment.status !== 'delivered' && shipment.status !== 'cancelled' ? (
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                  {shipment.status === 'planned' && (
                    <Button size="small" variant="contained" onClick={() => handleStatusChange('in_transit')}>
                      В пути
                    </Button>
                  )}
                  {shipment.status === 'in_transit' && (
                    <Button size="small" variant="contained" onClick={() => handleStatusChange('delivered')}>
                      Доставлено
                    </Button>
                  )}
                  <Button size="small" variant="outlined" color="error" onClick={() => handleStatusChange('cancelled')}>
                    Отменить
                  </Button>
                </Stack>
              ) : (
                <Typography mt={1} color={shipment.status === 'delivered' ? 'success.main' : 'error.main'}>
                  {shipment.status === 'delivered' ? '✓ Доставлено' : '✕ Отменено'}
                </Typography>
              )}
            </Stack>
          ) : (
            <Typography color="text.secondary">Доставка не найдена</Typography>
          )}
        </CardContent>
      </Card>

      {/* Диалог редактирования состава */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Состав партии</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Укажите количество по строкам заказа для этой партии. Нельзя больше остатка (Заказано − Уже распределено в других партиях).
            В доставку попадут только строки с qty &gt; 0.
          </DialogContentText>

          {orderQ.isLoading || orderShipmentsQ.isLoading ? (
            <Box p={2} display="flex" justifyContent="center"><CircularProgress size={22} /></Box>
          ) : orderQ.isError || orderShipmentsQ.isError ? (
            <Typography color="error">Не удалось загрузить строки заказа/доставки</Typography>
          ) : (
            (() => {
              const rows = buildEditRows();
              const selected = rows.filter((r: any) => r.toDeliver > 0);
              const hasInvalid = selected.some((r: any) => !r.valid);
              const canSubmit = selected.length > 0 && !hasInvalid;
              return (
                <Stack spacing={1.5}>
                  <Paper variant="outlined">
                    <Table size="small" sx={{ '& th, & td': { px: 1, py: 0.75 } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Номенклатура</TableCell>
                          <TableCell align="right" sx={{ width: 120 }}>Заказано</TableCell>
                          <TableCell align="right" sx={{ width: 150 }}>Уже распределено</TableCell>
                          <TableCell align="right" sx={{ width: 120 }}>Остаток</TableCell>
                          <TableCell align="right" sx={{ width: 170 }}>В этой партии</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((r: any) => {
                          const disabled = r.isBlocked;
                          const showError = r.toDeliver > 0 && !r.valid;
                          const remaining = Math.max(r.max, 0);
                          return (
                            <TableRow key={r.poLineId} hover>
                              <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                                {r.name}{r.isBlocked ? ' (блок)' : ''}
                              </TableCell>
                              <TableCell align="right">{Number.isFinite(r.ordered) ? r.ordered : '—'}</TableCell>
                              <TableCell align="right">{Number.isFinite(r.allocatedOther) ? r.allocatedOther : 0}</TableCell>
                              <TableCell align="right">{Number.isFinite(remaining) ? remaining : 0}</TableCell>
                              <TableCell align="right">
                                <TextField
                                  size="small"
                                  value={r.toDeliverRaw}
                                  onChange={(e) => setLineEdits((prev) => ({ ...prev, [r.poLineId]: e.target.value }))}
                                  disabled={disabled}
                                  error={showError}
                                  helperText={
                                    showError
                                      ? `Макс: ${remaining}`
                                      : disabled
                                        ? 'Строка заблокирована'
                                        : (remaining <= 0 ? 'Остаток = 0' : `Макс: ${remaining}`)
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

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Выбрано строк: {selected.length}{hasInvalid ? ' (есть ошибки)' : ''}
                    </Typography>
                    <Button
                      variant="contained"
                      disabled={!canSubmit || setLinesMut.isPending}
                      onClick={() => {
                        if (!shipment) return;
                        const lines = rows
                          .filter((r: any) => r.toDeliver > 0 && r.valid)
                          .map((r: any) => ({ order_line_id: r.poLineId, qty: r.toDeliver }));
                        setLinesMut.mutate({ id: shipment.id, lines });
                      }}
                    >
                      Сохранить состав
                    </Button>
                  </Stack>
                </Stack>
              );
            })()
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог изменения статуса */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Изменить статус доставки</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Новый статус: {getStatusLabel('shipment', dlgStatus)}
          </Typography>
          <TextField
            label="Комментарий"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="Например: Задержка в пути, повреждена упаковка и т.д."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)}>Отмена</Button>
          <Button onClick={handleConfirmStatusChange} variant="contained" disabled={updateStatusMut.isPending}>
            Подтвердить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
