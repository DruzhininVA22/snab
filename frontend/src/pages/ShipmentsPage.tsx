/**
 * Доставки (Shipments).
 * 
 * Отслеживание доставки товаров от поставщиков,
 * регистрация получения и статусов доставки.
 */
/**
 * Доставки (Shipments).
 *
 * Отслеживание доставки товаров от поставщиков,
 * регистрация получения и статусов доставки.
 */

import * as React from 'react';

import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
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
    IconButton,
} from '@mui/material';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http, fixPath } from '../api/_http';

type ShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'issues';

type Shipment = {
    id: number;
    po_id: number;
    po_number: string;
    supplier_id: number;
    supplier_name: string;
    status: ShipmentStatus;
    tracking_number?: string;
    // legacy/compat field name (may be null)
    estimated_delivery: string;
    actual_delivery?: string;
    notes?: string;
    // extras (newer backend)
    project_name?: string | null;
    stage_name?: string | null;
    delivery_address?: string | null;
    planned_date?: string | null;
    lines?: Array<{
        id?: number;
        item_name?: string;
        name?: string;
        qty?: number;
        quantity?: number;
    }>;
    created_at: string;
    updated_at: string;
};

const statusColors: Record<ShipmentStatus, 'default' | 'info' | 'success' | 'error'> = {
    pending: 'default',
    in_transit: 'info',
    delivered: 'success',
    issues: 'error',
};

const statusLabels: Record<ShipmentStatus, string> = {
    pending: 'Ожидание',
    in_transit: 'В пути',
    delivered: 'Доставлено',
    issues: 'Проблемы',
};

export default function ShipmentsPage() {
    const qc = useQueryClient();

    const [selectedId, setSelectedId] = React.useState<number | null>(null);
    const [notes, setNotes] = React.useState<string>('');
    const [dlgOpen, setDlgOpen] = React.useState<boolean>(false);
    const [dlgStatus, setDlgStatus] = React.useState<ShipmentStatus>('in_transit');

    // Загрузка списка доставок
    const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
        queryKey: ['shipments'],
        queryFn: async () => {
            const res = await http.get(fixPath('/api/procurement/shipments/'));
            return Array.isArray(res.data) ? res.data : res.data?.results || [];
        },
    });

    // Детали выбранной доставки (нужны для состава/адреса и т.п.)
    const { data: selectedDetail } = useQuery<Shipment>({
        queryKey: ['shipment', selectedId],
        enabled: !!selectedId,
        queryFn: async () => {
            const res = await http.get(fixPath(`/api/procurement/shipments/${selectedId}/`));
            return res.data as Shipment;
        },
    });

    // Обновление статуса доставки
    const updateStatusMut = useMutation({
        mutationFn: (payload: { id: number; status: ShipmentStatus; notes?: string }) =>
            http.patch(fixPath(`/api/procurement/shipments/${payload.id}/`), {
                status: payload.status,
                notes: payload.notes,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['shipments'] });
            qc.invalidateQueries({ queryKey: ['shipment', selectedId] });
            setNotes('');
            setDlgOpen(false);
        },
    });

    const selected = (selectedDetail as Shipment | undefined) ?? shipments.find((s) => s.id === selectedId) ?? null;

    React.useEffect(() => {
        if (selected?.notes) setNotes(selected.notes);
    }, [selectedId]);

    const handleStatusChange = (status: ShipmentStatus) => {
        setDlgStatus(status);
        setDlgOpen(true);
    };

    const handleConfirmStatusChange = () => {
        if (selected) {
            updateStatusMut.mutate({
                id: selected.id,
                status: dlgStatus,
                notes,
            });
        }
    };

    return (
        <Box p={2}>
            <Typography variant="h5" gutterBottom>
                Доставки
            </Typography>

            <Grid container spacing={2}>
                {/* Список доставок */}
                <Grid item xs={12} md={7}>
                    <Paper>
                        {isLoading ? (
                            <Box p={2} display="flex" justifyContent="center">
                                <CircularProgress />
                            </Box>
                        ) : shipments.length === 0 ? (
                            <Box p={2}>
                                <Typography color="text.secondary">Доставок пока нет</Typography>
                            </Box>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>ID</TableCell>
                                            <TableCell>Заказ</TableCell>
                                            <TableCell>Объект</TableCell>
                                            <TableCell>Этап</TableCell>
                                            <TableCell>План. дата</TableCell>
                                            <TableCell>Статус</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {shipments.map((s) => (
                                            <TableRow
                                                key={s.id}
                                                hover
                                                onClick={() => setSelectedId(s.id)}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                <TableCell>{s.id}</TableCell>
                                                <TableCell>
                                                    <Box display="flex" alignItems="center" gap={0.5}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {s.po_number}
                                                        </Typography>
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Открыть заказ"
                                                            title="Открыть заказ"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // не используем react-router здесь, чтобы не трогать App.tsx
                                                                window.location.href = `/po?po_id=${encodeURIComponent(String(s.po_id))}`;
                                                            }}
                                                        >
                                                            <OpenInNewIcon fontSize="inherit" />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{s.project_name || '—'}</TableCell>
                                                <TableCell>{s.stage_name || '—'}</TableCell>
                                                <TableCell>{s.planned_date || s.estimated_delivery || '—'}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        color={statusColors[s.status]}
                                                        label={statusLabels[s.status]}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Grid>

                {/* Детали выбранной доставки */}
                <Grid item xs={12} md={5}>
                    <Card>
                        <CardContent>
                            {selected ? (
                                <Stack spacing={1}>
                                    <Typography variant="h6">Доставка #{selected.id}</Typography>
                                    <Divider />
                                    <Typography variant="body2">
                                        <strong>Заказ:</strong>{' '}
                                        <a href={`/po?po_id=${encodeURIComponent(String(selected.po_id))}`}>{selected.po_number}</a>
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>Поставщик:</strong> {selected.supplier_name}
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>Объект:</strong> {selected.project_name || '—'}
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>Этап:</strong> {selected.stage_name || '—'}
                                    </Typography>
                                    {selected.tracking_number && (
                                        <Typography variant="body2">
                                            <strong>Трек-номер:</strong> {selected.tracking_number}
                                        </Typography>
                                    )}
                                    <Typography variant="body2">
                                        <strong>Статус:</strong> {statusLabels[selected.status]}
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>Планируемая дата доставки:</strong>{' '}
                                        {selected.planned_date || selected.estimated_delivery || '—'}
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>Адрес доставки:</strong> {selected.delivery_address || '—'}
                                    </Typography>
                                    {selected.actual_delivery && (
                                        <Typography variant="body2">
                                            <strong>Фактическая дата доставки:</strong> {selected.actual_delivery}
                                        </Typography>
                                    )}
                                    {selected.notes && (
                                        <Typography variant="body2">
                                            <strong>Примечания:</strong> {selected.notes}
                                        </Typography>
                                    )}

                                    <Divider sx={{ my: 1 }} />

                                    <Typography variant="subtitle2">Состав доставки</Typography>
                                    {Array.isArray(selected.lines) && selected.lines.length > 0 ? (
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Наименование</TableCell>
                                                    <TableCell align="right">Кол-во</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {selected.lines.map((ln, idx) => {
                                                    const name = ln.item_name || ln.name || `Строка ${idx + 1}`;
                                                    const qty = (ln.qty ?? ln.quantity ?? 0) as number;
                                                    return (
                                                        <TableRow key={(ln.id ?? idx) as any}>
                                                            <TableCell>{name}</TableCell>
                                                            <TableCell align="right">{qty}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">
                                            Строки доставки не загружены.
                                        </Typography>
                                    )}

                                    {selected.status !== 'delivered' ? (
                                        <Stack direction="row" spacing={1} mt={2}>
                                            {selected.status === 'pending' && (
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => handleStatusChange('in_transit')}
                                                >
                                                    В пути
                                                </Button>
                                            )}
                                            {selected.status === 'in_transit' && (
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => handleStatusChange('delivered')}
                                                >
                                                    Доставлено
                                                </Button>
                                            )}
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                onClick={() => handleStatusChange('issues')}
                                            >
                                                Проблема с доставкой
                                            </Button>
                                        </Stack>
                                    ) : (
                                        <Typography mt={2} color="success.main">
                                            ✓ Доставлено
                                        </Typography>
                                    )}
                                </Stack>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Выберите доставку для просмотра деталей
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Диалог изменения статуса */}
            <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Изменить статус доставки</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" gutterBottom>
                        Новый статус: {statusLabels[dlgStatus]}
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
                    <Button onClick={handleConfirmStatusChange} variant="contained">
                        Подтвердить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
