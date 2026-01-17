/**
 * Коммерческие предложения (Quotations).
 * 
 * Регистрация полученных КП от поставщиков,
 * выбор лучшего варианта для создания заказа.
 */
import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
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
    Chip,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, fixPath } from '../api/_http';

type QuotationStatus = 'received' | 'reviewed' | 'selected' | 'rejected';

type Quotation = {
    id: number;
    rfq_id: number;
    supplier_id: number;
    supplier_name: string;
    status: QuotationStatus;
    total_price: number;
    currency: string;
    delivery_days: number;
    notes?: string;
    received_at: string;
    created_at: string;
};

const statusColors: Record<QuotationStatus, 'default' | 'info' | 'success' | 'error'> = {
    received: 'info',
    reviewed: 'default',
    selected: 'success',
    rejected: 'error',
};

const statusLabels: Record<QuotationStatus, string> = {
    received: 'Получено',
    reviewed: 'Рассмотрено',
    selected: 'Выбрано',
    rejected: 'Отклонено',
};

export default function QuotationsPage() {
    const qc = useQueryClient();
    const [selectedId, setSelectedId] = React.useState<number | null>(null);

    // Загрузка КП
    const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
        queryKey: ['quotations'],
        queryFn: async () => {
            const res = await http.get(fixPath('apiprocurement/quotes'));
            return Array.isArray(res.data) ? res.data : res.data?.results || [];
        },
    });

    // Обновление статуса
    const updateStatusMut = useMutation({
        mutationFn: (payload: { id: number; status: QuotationStatus }) =>
            http.patch(fixPath(`apiprocurement/quotes/${payload.id}`), { status: payload.status }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['quotations'] });
        },
    });

    // Создание заказа из КП
    const createPOMut = useMutation({
        mutationFn: (quotationId: number) =>
            http.post(fixPath(`apiprocurement/quotes/${quotationId}/create_po`), {}),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['quotations'] });
            setSelectedId(null);
        },
    });

    const selected = quotations.find((q) => q.id === selectedId);

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Коммерческие предложения
            </Typography>

            <Grid container spacing={2}>
                {/* Список КП */}
                <Grid item xs={12} md={8}>
                    {isLoading ? (
                        <CircularProgress />
                    ) : (
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                        <TableCell>ID</TableCell>
                                        <TableCell>Поставщик</TableCell>
                                        <TableCell align="right">Сумма</TableCell>
                                        <TableCell align="center">Дней</TableCell>
                                        <TableCell>Статус</TableCell>
                                        <TableCell align="center">Действие</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {quotations.map((q) => (
                                        <TableRow
                                            key={q.id}
                                            hover
                                            selected={selectedId === q.id}
                                            onClick={() => setSelectedId(q.id)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <TableCell>{q.id}</TableCell>
                                            <TableCell sx={{ fontWeight: 500 }}>
                                                {q.supplier_name}
                                            </TableCell>
                                            <TableCell align="right">
                                                {q.total_price.toLocaleString()} {q.currency}
                                            </TableCell>
                                            <TableCell align="center">{q.delivery_days}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={statusLabels[q.status]}
                                                    color={statusColors[q.status]}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                {q.status === 'received' && (
                                                    <Button
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateStatusMut.mutate({
                                                                id: q.id,
                                                                status: 'reviewed',
                                                            });
                                                        }}
                                                    >
                                                        Рассмотреть
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Grid>

                {/* Детали выбранного КП */}
                <Grid item xs={12} md={4}>
                    {selected ? (
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                КП #{selected.id}
                            </Typography>
                            <Stack spacing={1.5}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Поставщик
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {selected.supplier_name}
                                    </Typography>
                                </Box>
                                <Divider />
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Сумма
                                    </Typography>
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 700,
                                            color: 'primary.main',
                                        }}
                                    >
                                        {selected.total_price.toLocaleString()} {selected.currency}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Сроки доставки
                                    </Typography>
                                    <Typography variant="body1">
                                        {selected.delivery_days} дней
                                    </Typography>
                                </Box>
                                {selected.notes && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Примечания
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{ whiteSpace: 'pre-wrap', color: '#666' }}
                                        >
                                            {selected.notes}
                                        </Typography>
                                    </Box>
                                )}
                                <Divider />
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        disabled={selected.status !== 'reviewed' || createPOMut.isLoading}
                                        onClick={() => createPOMut.mutate(selected.id)}
                                    >
                                        Создать заказ
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        color="error"
                                        disabled={selected.status === 'rejected'}
                                        onClick={() =>
                                            updateStatusMut.mutate({
                                                id: selected.id,
                                                status: 'rejected',
                                            })
                                        }
                                    >
                                        Отклонить
                                    </Button>
                                </Stack>
                            </Stack>
                        </Paper>
                    ) : (
                        <Paper sx={{ p: 2 }}>
                            <Typography color="text.secondary" align="center">
                                Выберите КП для просмотра деталей
                            </Typography>
                        </Paper>
                    )}
                </Grid>
            </Grid>
        </Box>
    );
}
