/**
 * Доставки (Shipments) — список.
 *
 * Для MVP: без двухпанельного UI (который ломает таблицу на разных ширинах).
 * Детали доставки открываются на отдельной странице: /shipments/:id
 */

import * as React from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  Box,
  Checkbox,
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

import { useQuery } from '@tanstack/react-query';

import { http, fixPath } from '../api/_http';
import StatusChip from '../components/StatusChip';

type ShipmentStatus = 'planned' | 'in_transit' | 'delivered' | 'cancelled';

type Shipment = {
  id: number;
  short_number?: string | null;
  order_id: number;
  order_number: string;
  supplier_name: string;
  status: ShipmentStatus;
  eta_date?: string | null;
  notes?: string | null;
  project_name?: string | null;
  stage_name?: string | null;
  request_items_total?: number | null;
  request_items_fulfilled?: number | null;
  request_fulfilled_pct?: number | null;
  shipment_items_count?: number | null;
  shipment_cover_pct?: number | null;
  created_at: string;
  updated_at: string;
};

function isShipmentCompleted(s: Shipment): boolean {
  return s.status === 'delivered' || s.status === 'cancelled';
}

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Backward compatibility: /shipments?shipment_id=123 → /shipments/123
  React.useEffect(() => {
    const raw = searchParams.get('shipment_id');
    if (!raw) return;
    const id = Number(raw);
    if (Number.isFinite(id) && id > 0) {
      navigate(`/shipments/${encodeURIComponent(String(id))}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const STORAGE_KEY_COMPLETED = 'snab.shipments.showCompleted';
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

  const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
    queryKey: ['shipments'],
    queryFn: async () => {
      const res = await http.get(fixPath('/api/procurement/shipments/'));
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const filteredShipments = React.useMemo(() => {
    const q = qText.trim().toLowerCase();
    return shipments.filter((s) => {
      if (!showCompleted && isShipmentCompleted(s)) return false;
      if (!q) return true;
      const hay = `${s.id} ${s.short_number ?? ''} ${s.order_number ?? ''} ${s.supplier_name ?? ''} ${s.project_name ?? ''} ${s.stage_name ?? ''} ${s.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [shipments, qText, showCompleted]);

  return (
    <Box p={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        spacing={1.25}
        sx={{ mb: 1 }}
      >
        <Typography variant="h5">Доставки</Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <TextField
            size="small"
            label="Поиск (номер / заказ / проект / этап / комм.)"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 380 } }}
          />
          <FormControlLabel
            sx={{ ml: 0.5, userSelect: 'none' }}
            control={<Checkbox checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />}
            label={<Typography variant="body2">Показывать завершённые</Typography>}
          />
        </Stack>
      </Stack>

      <Paper>
        {isLoading ? (
          <Box p={2} display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
        ) : filteredShipments.length === 0 ? (
          <Box p={2}>
            <Typography color="text.secondary">Доставок не найдено</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'hidden' }}>
            <Table
              size="small"
              sx={{
                width: '100%',
                tableLayout: 'fixed',
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '8%', whiteSpace: 'nowrap' }}>№</TableCell>
                  <TableCell sx={{ width: '12%', whiteSpace: 'nowrap' }}>Заказ</TableCell>
                  <TableCell sx={{ width: '12%' }}>Проект</TableCell>
                  <TableCell sx={{ width: '22%' }}>Этап</TableCell>
                  <TableCell sx={{ width: '10%', whiteSpace: 'nowrap' }}>План. дата</TableCell>
                  <TableCell sx={{ width: '12%', whiteSpace: 'nowrap' }}>Статус</TableCell>
                  <TableCell sx={{ width: '12%' }}>Прогресс</TableCell>
                  <TableCell sx={{ width: '12%' }}>Комментарий</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredShipments.map((s) => (
                  <TableRow
                    key={s.id}
                    hover
                    onClick={() => navigate(`/shipments/${encodeURIComponent(String(s.id))}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {s.short_number || `D-${s.id}`}
                    </TableCell>

                    <TableCell sx={{ overflow: 'hidden' }}>
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                          {s.order_number}
                        </Typography>
                        <Tooltip title="Открыть заказ">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/po?order_id=${encodeURIComponent(String(s.order_id))}`);
                            }}
                          >
                            <OpenInNewIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>

                    {/* line-clamp ставим на внутренний Box, иначе таблица начинает "ехать" */}
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {s.project_name ? (
                        <Tooltip title={s.project_name} placement="top" arrow>
                          <Box
                            sx={{
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {s.project_name}
                          </Box>
                        </Tooltip>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {s.stage_name ? (
                        <Tooltip title={s.stage_name} placement="top" arrow>
                          <Box
                            sx={{
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {s.stage_name}
                          </Box>
                        </Tooltip>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.eta_date || '—'}</TableCell>

                    <TableCell>
                      <StatusChip entity="shipment" status={s.status} compact />
                    </TableCell>

                    <TableCell sx={{ whiteSpace: 'normal' }}>
                      {typeof s.request_items_total === 'number' && s.request_items_total > 0 ? (
                        <Stack spacing={0}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {s.request_items_fulfilled ?? 0}/{s.request_items_total}
                            {typeof s.request_fulfilled_pct === 'number' ? ` (${s.request_fulfilled_pct}%)` : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Доля: {s.shipment_items_count ?? 0}/{s.request_items_total}
                            {typeof s.shipment_cover_pct === 'number' ? ` (${s.shipment_cover_pct}%)` : ''}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={s.notes || ''}
                    >
                      {s.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
