/**
 * 📄 SupplierPriceListDetailPage.tsx
 * 
 * Страница для редактирования СТРОК (товаров) в прайс-листе
 * 
 * На этой странице:
 * - Видна информация о прайс-листе (поставщик, версия, валюта, и т.д.)
 * - Таблица товаров в этом прайс-листе
 * - Кнопки: Добавить товар, Редактировать, Удалить
 * - Диалоги для редактирования/добавления товаров
 */

import * as React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    CircularProgress,
    Alert,
    Chip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, useNavigate } from 'react-router-dom';
import { http } from '../../api/_http';

// ════════════════════════════════════════════════════════════════
// ТИПЫ ДАННЫХ
// ════════════════════════════════════════════════════════════════

interface Unit {
    id: number;
    name: string;
    short_name: string;
}

interface PriceListLine {
    id: number;
    price_list: number;
    supplier_sku: string;
    description: string;
    unit: number;
    unit_name?: string;
    price: number;
    min_quantity: number;
    lead_time_days: number;
    notes: string;
}

interface SupplierPriceList {
    id: number;
    supplier: number;
    supplier_name?: string;
    name: string;
    version: string;
    effective_date: string;
    expiry_date?: string;
    currency: string;
    is_active: boolean;
    lines?: PriceListLine[];
}

interface LineFormData {
    supplier_sku: string;
    description: string;
    unit: number;
    price: number | '';
    min_quantity: number | '';
    lead_time_days: number | '';
    notes: string;
}

// ════════════════════════════════════════════════════════════════
// КОМПОНЕНТ СТРАНИЦЫ
// ════════════════════════════════════════════════════════════════

export default function SupplierPriceListDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const priceListId = parseInt(id || '0', 10);

    // ════════════════════════════════════════════════════════════════
    // СОСТОЯНИЕ
    // ════════════════════════════════════════════════════════════════

    const [priceList, setPriceList] = React.useState<SupplierPriceList | null>(
        null
    );
    const [lines, setLines] = React.useState<PriceListLine[]>([]);
    const [units, setUnits] = React.useState<Unit[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Диалоги
    const [openLineDialog, setOpenLineDialog] = React.useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false);

    // Редактирование
    const [editingLineId, setEditingLineId] = React.useState<number | null>(null);
    const [deletingLineId, setDeletingLineId] = React.useState<number | null>(null);

    // Форма
    const [lineForm, setLineForm] = React.useState<LineFormData>({
        supplier_sku: '',
        description: '',
        unit: 0,
        price: '',
        min_quantity: '',
        lead_time_days: '',
        notes: '',
    });
    const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

    // ════════════════════════════════════════════════════════════════
    // ЗАГРУЗКА ДАННЫХ
    // ════════════════════════════════════════════════════════════════

    React.useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Загрузить прайс-лист с товарами
                const priceListResponse = await http.get(
                    `/api/procurement/supplier-price-lists/${priceListId}/`
                );
                setPriceList(priceListResponse.data);
                setLines(priceListResponse.data.lines || []);

                // Загрузить единицы измерения
                const unitsResponse = await http.get('/api/reference/units/');
                setUnits(unitsResponse.data || []);
            } catch (err) {
                console.error('Ошибка загрузки:', err);
                setError('Ошибка загрузки данных');
            } finally {
                setLoading(false);
            }
        };

        if (priceListId > 0) {
            loadData();
        }
    }, [priceListId]);

    // ════════════════════════════════════════════════════════════════
    // ОБРАБОТЧИКИ ДИАЛОГОВ
    // ════════════════════════════════════════════════════════════════

    const handleOpenCreateLineDialog = () => {
        setEditingLineId(null);
        setLineForm({
            supplier_sku: '',
            description: '',
            unit: 0,
            price: '',
            min_quantity: '',
            lead_time_days: '',
            notes: '',
        });
        setFormErrors({});
        setOpenLineDialog(true);
    };

    const handleOpenEditLineDialog = (line: PriceListLine) => {
        setEditingLineId(line.id);
        setLineForm({
            supplier_sku: line.supplier_sku,
            description: line.description,
            unit: line.unit,
            price: line.price,
            min_quantity: line.min_quantity,
            lead_time_days: line.lead_time_days,
            notes: line.notes,
        });
        setFormErrors({});
        setOpenLineDialog(true);
    };

    const handleCloseLineDialog = () => {
        setOpenLineDialog(false);
        setEditingLineId(null);
        setLineForm({
            supplier_sku: '',
            description: '',
            unit: 0,
            price: '',
            min_quantity: '',
            lead_time_days: '',
            notes: '',
        });
        setFormErrors({});
    };

    const handleOpenDeleteDialog = (lineId: number) => {
        setDeletingLineId(lineId);
        setOpenDeleteDialog(true);
    };

    // ════════════════════════════════════════════════════════════════
    // ВАЛИДАЦИЯ И ОТПРАВКА ФОРМЫ
    // ════════════════════════════════════════════════════════════════

    const validateLineForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!lineForm.supplier_sku.trim()) {
            errors.supplier_sku = 'SKU обязателен';
        }
        if (!lineForm.description.trim()) {
            errors.description = 'Описание обязательно';
        }
        if (lineForm.unit === 0 || lineForm.unit === '') {
            errors.unit = 'Единица измерения обязательна';
        }
        if (lineForm.price === '' || lineForm.price === 0) {
            errors.price = 'Цена обязательна';
        }
        if (lineForm.min_quantity === '' || lineForm.min_quantity === 0) {
            errors.min_quantity = 'Минимальное количество обязательно';
        }
        if (lineForm.lead_time_days === '') {
            errors.lead_time_days = 'Время доставки обязательно';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmitLineForm = async () => {
        if (!validateLineForm()) return;

        try {
            const payload = {
                price_list: priceListId,
                supplier_sku: lineForm.supplier_sku,
                description: lineForm.description,
                unit: lineForm.unit,
                price: lineForm.price,
                min_quantity: lineForm.min_quantity,
                lead_time_days: lineForm.lead_time_days,
                notes: lineForm.notes,
            };

            if (editingLineId) {
                // Обновление существующей строки
                await http.patch(
                    `/api/procurement/price-list-lines/${editingLineId}/`,
                    payload
                );
            } else {
                // Создание новой строки
                await http.post('/api/procurement/price-list-lines/', payload);
            }

            // Перезагрузить данные
            const response = await http.get(
                `/api/procurement/supplier-price-lists/${priceListId}/`
            );
            setLines(response.data.lines || []);

            handleCloseLineDialog();
        } catch (err) {
            console.error('Ошибка сохранения:', err);
            setError('Ошибка при сохранении товара');
        }
    };

    const handleConfirmDeleteLine = async () => {
        if (deletingLineId === null) return;

        try {
            await http.delete(`/api/procurement/price-list-lines/${deletingLineId}/`);

            // Перезагрузить данные
            const response = await http.get(
                `/api/procurement/supplier-price-lists/${priceListId}/`
            );
            setLines(response.data.lines || []);

            setOpenDeleteDialog(false);
            setDeletingLineId(null);
        } catch (err) {
            console.error('Ошибка удаления:', err);
            setError('Ошибка при удалении товара');
        }
    };

    // ════════════════════════════════════════════════════════════════
    // ПОЛУЧЕНИЕ НАЗВАНИЯ ЕДИНИЦЫ
    // ════════════════════════════════════════════════════════════════

    const getUnitName = (unitId: number): string => {
        const unit = units.find((u) => u.id === unitId);
        return unit ? unit.short_name : `Ед. #${unitId}`;
    };

    // ════════════════════════════════════════════════════════════════
    // РЕНДЕР
    // ════════════════════════════════════════════════════════════════

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!priceList) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">Прайс-лист не найден</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* КНОПКА ВОЗВРАТА */}
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/price-lists')}
                sx={{ mb: 2 }}
            >
                Вернуться к списку
            </Button>

            {/* ИНФОРМАЦИЯ О ПРАЙС-ЛИСТЕ */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                        {priceList.name} (v{priceList.version})
                    </Typography>

                    <Stack direction="row" spacing={3}>
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Поставщик
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {priceList.supplier_name || `Поставщик #${priceList.supplier}`}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Валюта
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                            >
                                {priceList.currency}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Статус
                            </Typography>
                            <Chip
                                label={priceList.is_active ? 'Активен' : 'Неактивен'}
                                color={priceList.is_active ? 'success' : 'default'}
                                variant="outlined"
                                size="small"
                            />
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Дата начала
                            </Typography>
                            <Typography variant="body2">
                                {priceList.effective_date
                                    ? new Date(priceList.effective_date).toLocaleDateString(
                                        'ru-RU'
                                    )
                                    : '—'}
                            </Typography>
                        </Box>

                        {priceList.expiry_date && (
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Дата окончания
                                </Typography>
                                <Typography variant="body2">
                                    {new Date(priceList.expiry_date).toLocaleDateString('ru-RU')}
                                </Typography>
                            </Box>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* СООБЩЕНИЕ ОБ ОШИБКЕ */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* ТАБЛИЦА ТОВАРОВ */}
            <Card>
                <CardContent>
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2,
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Товары в прайс-листе ({lines.length})
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleOpenCreateLineDialog}
                        >
                            Добавить товар
                        </Button>
                    </Box>

                    {lines.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                            Товаров нет. Нажмите "Добавить товар" для создания.
                        </Typography>
                    ) : (
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                                    <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Описание</TableCell>
                                    <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>
                                        Цена
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>
                                        Ед.
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>
                                        Мин. кол-во
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>
                                        Дней доставки
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>
                                        Действия
                                    </TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {lines.map((line) => (
                                    <TableRow key={line.id} hover>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {line.supplier_sku}
                                            </Typography>
                                        </TableCell>

                                        <TableCell>
                                            <Typography variant="body2">{line.description}</Typography>
                                        </TableCell>

                                        <TableCell align="right">
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {line.price.toFixed(2)} {priceList.currency}
                                            </Typography>
                                        </TableCell>

                                        <TableCell align="center">
                                            <Typography variant="body2" color="text.secondary">
                                                {getUnitName(line.unit)}
                                            </Typography>
                                        </TableCell>

                                        <TableCell align="center">
                                            <Typography variant="body2">{line.min_quantity}</Typography>
                                        </TableCell>

                                        <TableCell align="center">
                                            <Typography variant="body2">{line.lead_time_days}</Typography>
                                        </TableCell>

                                        <TableCell align="center">
                                            <Stack direction="row" spacing={0.5} justifyContent="center">
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => handleOpenEditLineDialog(line)}
                                                    title="Редактировать"
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>

                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleOpenDeleteDialog(line.id)}
                                                    title="Удалить"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* ДИАЛОГ СОЗДАНИЯ/РЕДАКТИРОВАНИЯ ТОВАРА */}
            <Dialog
                open={openLineDialog}
                onClose={handleCloseLineDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {editingLineId ? 'Редактировать товар' : 'Добавить товар'}
                </DialogTitle>

                <DialogContent sx={{ pt: 2 }}>
                    <Stack spacing={2}>
                        {/* SKU */}
                        <TextField
                            fullWidth
                            label="SKU поставщика"
                            value={lineForm.supplier_sku}
                            onChange={(e) =>
                                setLineForm({ ...lineForm, supplier_sku: e.target.value })
                            }
                            error={!!formErrors.supplier_sku}
                            helperText={formErrors.supplier_sku}
                            placeholder="ABC-123"
                        />

                        {/* ОПИСАНИЕ */}
                        <TextField
                            fullWidth
                            label="Описание товара"
                            value={lineForm.description}
                            onChange={(e) =>
                                setLineForm({ ...lineForm, description: e.target.value })
                            }
                            error={!!formErrors.description}
                            helperText={formErrors.description}
                            placeholder="Болты метрические М10"
                            multiline
                            rows={2}
                        />

                        {/* ЕДИНИЦА ИЗМЕРЕНИЯ */}
                        <FormControl fullWidth error={!!formErrors.unit}>
                            <InputLabel>Единица измерения</InputLabel>
                            <Select
                                value={lineForm.unit || ''}
                                onChange={(e) =>
                                    setLineForm({
                                        ...lineForm,
                                        unit: parseInt(e.target.value as string, 10),
                                    })
                                }
                                label="Единица измерения"
                            >
                                <MenuItem value="">Выберите единицу</MenuItem>
                                {units.map((unit) => (
                                    <MenuItem key={unit.id} value={unit.id}>
                                        {unit.name} ({unit.short_name})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* ЦЕНА */}
                        <TextField
                            fullWidth
                            label="Цена"
                            type="number"
                            inputProps={{ step: '0.01', min: '0' }}
                            value={lineForm.price}
                            onChange={(e) =>
                                setLineForm({
                                    ...lineForm,
                                    price: e.target.value ? parseFloat(e.target.value) : '',
                                })
                            }
                            error={!!formErrors.price}
                            helperText={formErrors.price}
                            placeholder="15.50"
                        />

                        {/* МИНИМАЛЬНОЕ КОЛИЧЕСТВО */}
                        <TextField
                            fullWidth
                            label="Минимальное количество"
                            type="number"
                            inputProps={{ min: '1' }}
                            value={lineForm.min_quantity}
                            onChange={(e) =>
                                setLineForm({
                                    ...lineForm,
                                    min_quantity: e.target.value ? parseInt(e.target.value, 10) : '',
                                })
                            }
                            error={!!formErrors.min_quantity}
                            helperText={formErrors.min_quantity}
                            placeholder="100"
                        />

                        {/* ВРЕМЯ ДОСТАВКИ */}
                        <TextField
                            fullWidth
                            label="Время доставки (дней)"
                            type="number"
                            inputProps={{ min: '0' }}
                            value={lineForm.lead_time_days}
                            onChange={(e) =>
                                setLineForm({
                                    ...lineForm,
                                    lead_time_days: e.target.value
                                        ? parseInt(e.target.value, 10)
                                        : '',
                                })
                            }
                            error={!!formErrors.lead_time_days}
                            helperText={formErrors.lead_time_days}
                            placeholder="7"
                        />

                        {/* ПРИМЕЧАНИЯ */}
                        <TextField
                            fullWidth
                            label="Примечания"
                            value={lineForm.notes}
                            onChange={(e) =>
                                setLineForm({ ...lineForm, notes: e.target.value })
                            }
                            placeholder="Опционально"
                            multiline
                            rows={2}
                        />
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleCloseLineDialog}>Отмена</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmitLineForm}
                    >
                        {editingLineId ? 'Сохранить' : 'Добавить'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ДИАЛОГ УДАЛЕНИЯ */}
            <Dialog
                open={openDeleteDialog}
                onClose={() => setOpenDeleteDialog(false)}
            >
                <DialogTitle>Удалить товар?</DialogTitle>
                <DialogContent>
                    <Typography>Это действие нельзя отменить.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteDialog(false)}>Отмена</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleConfirmDeleteLine}
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
