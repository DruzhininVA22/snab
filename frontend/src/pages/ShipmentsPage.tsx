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
} from '@mui/material';
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
    estimated_delivery: string;
    actual_delivery?: string;
    notes?: string;
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
    const [notes, setNotes] = React.useState('');
    const [dlgOpen, setDlgOpen] = React.useState(false);
    const [dlgStatus, setDlgStatus] = React.useState<ShipmentStatus>('in_transit');

    // Загрузка списка доставок
    const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
        queryKey: ['shipments'],
        queryFn: async () => {
            const res = await http.get(fixPath('apiprocurement/shipments'));
            return Array.isArray(res.data) ? res.data : res.data?.results || [];
        },
    });

    // Обновление статуса доставки
    const updateStatusMut = useMutation({
        mutationFn: (payload: {
            id: number;
            status: ShipmentStatus;
            notes?: string;
        }) =>
            http.patch(fixPath(`apiprocurement/shipments/${payload.id}`), {
                status: payload.status,
                notes: payload.notes || '',
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['shipments'] });
            setNotes('');
            setDlgOpen(false);
        },
    });

    const selected = shipments.find((s) => s.id === selectedId);

    const handleStatusChange = (status: ShipmentStatus) => {
        setDlgStatus(status);
        setDlgOpen(true);
    };

    const handleConfirmStatusChange = () => {
        if (selected) {
            updateStatusMut.mutate({
                id: selected.id,
                status: dlgStatus,
                notes: notes,
            });
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Доставки
            </Typography>

            <Grid container spacing={2}>
                {/* Список доставок */}
                <Grid item xs={12} md={8}>
                    {isLoading ? (
                        <CircularProgress />
                    ) : shipments.length === 0 ? (
                        <Paper sx={{ p: 3 }}>
                            <Typography color="text.secondary" align="center">
                                Доставок пока нет
                            </Typography>
                        </Paper>
                    ) : (
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                        <TableCell>ID</TableCell>
                                        <TableCell>Заказ</TableCell>
                                        <TableCell>Поставщик</TableCell>
                                        <TableCell>Ожид. дата</TableCell>
                                        <TableCell>Статус</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {shipments.map((s) => (
                                        <TableRow
                                            key={s.id}
                                            hover
                                            selected={selectedId === s.id}
                                            onClick={() => setSelectedId(s.id)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <TableCell>{s.id}</TableCell>
                                            <TableCell sx={{ fontWeight: 500 }}>
                                                {s.po_number}
                                            </TableCell>
                                            <TableCell>{s.supplier_name}</TableCell>
                                            <TableCell>{s.estimated_delivery}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={statusLabels[s.status]}
                                                    color={statusColors[s.status]}
                                                    size="small"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Grid>

                {/* Детали выбранной доставки */}
                <Grid item xs={12} md={4}>
                    {selected ? (
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Доставка #{selected.id}
                            </Typography>
                            <Stack spacing={1.5}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Заказ
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {selected.po_number}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Поставщик
                                    </Typography>
                                    <Typography variant="body1">
                                        {selected.supplier_name}
                                    </Typography>
                                </Box>

                                {selected.tracking_number && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Трек-номер
                                        </Typography>
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontWeight: 500,
                                            }}
                                        >
                                            {selected.tracking_number}
                                        </Typography>
                                    </Box>
                                )}

                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Статус
                                    </Typography>
                                    <Chip
                                        label={statusLabels[selected.status]}
                                        color={statusColors[selected.status]}
                                        sx={{ mt: 0.5 }}
                                    />
                                </Box>

                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Ожидаемая дата доставки
                                    </Typography>
                                    <Typography variant="body1">
                                        {selected.estimated_delivery}
                                    </Typography>
                                </Box>

                                {selected.actual_delivery && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Фактическая дата доставки
                                        </Typography>
                                        <Typography variant="body1" sx={{ color: 'success.main' }}>
                                            {selected.actual_delivery}
                                        </Typography>
                                    </Box>
                                )}

                                {selected.notes && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Примечания
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                whiteSpace: 'pre-wrap',
                                                color: '#666',
                                                mt: 0.5,
                                            }}
                                        >
                                            {selected.notes}
                                        </Typography>
                                    </Box>
                                )}

                                <Divider sx={{ my: 1 }} />

                                <Stack direction="column" spacing={1}>
                                    {selected.status !== 'delivered' && (
                                        <>
                                            {selected.status === 'pending' && (
                                                <Button
                                                    variant="contained"
                                                    fullWidth
                                                    onClick={() => handleStatusChange('in_transit')}
                                                >
                                                    В пути
                                                </Button>
                                            )}

                                            {selected.status === 'in_transit' && (
                                                <Button
                                                    variant="contained"
                                                    color="success"
                                                    fullWidth
                                                    onClick={() => handleStatusChange('delivered')}
                                                >
                                                    Доставлено
                                                </Button>
                                            )}

                                            <Button
                                                variant="outlined"
                                                color="error"
                                                fullWidth
                                                disabled={selected.status === 'issues'}
                                                onClick={() => handleStatusChange('issues')}
                                            >
                                                Проблема с доставкой
                                            </Button>
                                        </>
                                    )}

                                    {selected.status === 'delivered' && (
                                        <Typography
                                            variant="body2"
                                            align="center"
                                            sx={{
                                                color: 'success.main',
                                                fontWeight: 600,
                                                py: 1,
                                            }}
                                        >
                                            ✓ Доставлено
                                        </Typography>
                                    )}
                                </Stack>
                            </Stack>
                        </Paper>
                    ) : (
                        <Paper sx={{ p: 2 }}>
                            <Typography color="text.secondary" align="center">
                                Выберите доставку для просмотра деталей
                            </Typography>
                        </Paper>
                    )}
                </Grid>
            </Grid>

            {/* Диалог изменения статуса */}
            <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Изменить статус доставки</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Новый статус: <strong>{statusLabels[dlgStatus]}</strong>
                        </Typography>
                        <TextField
                            label="Примечания (опционально)"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            fullWidth
                            multiline
                            minRows={3}
                            placeholder="Например: Задержка в пути, повреждена упаковка и т.д."
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDlgOpen(false)}>Отмена</Button>
                    <Button
                        variant="contained"
                        disabled={updateStatusMut.isLoading}
                        onClick={handleConfirmStatusChange}
                    >
                        Подтвердить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
