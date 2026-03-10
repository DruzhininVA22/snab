/**
 * SupplierPriceListsPage.tsx - РАСШИРЕННАЯ ВЕРСИЯ
 * 
 * Полная реализация со всеми функциями:
 * - Таблица с прайс-листами
 * - Фильтр по поставщику
 * - Поиск
 * - Кнопка "Создать прайс-лист"
 * - Кнопки "Редактировать" и "Удалить" в каждой строке
 * - Диалоги для создания/редактирования
 * - Подтверждение перед удалением
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
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress,
    TextField,
    Stack,
    Button,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    FormControlLabel,
    Checkbox,
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { http } from '../../api/_http';
import {
    useSupplierPriceLists,
    useCreateSupplierPriceList,
    useUpdateSupplierPriceList,
    useDeleteSupplierPriceList,
    CreateUpdateSupplierPriceListPayload,
    SupplierPriceList,
} from '../../api/supplierPriceLists';
import { useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';

/**
 * ================================================
 * ИНТЕРФЕЙСЫ
 * ================================================
 */

interface SupplierOption {
    id: number;
    name: string;
}

/**
 * ================================================
 * ОСНОВНОЙ КОМПОНЕНТ
 * ================================================
 */

export default function SupplierPriceListsPage() {
    // ========================
    // СОСТОЯНИЕ - ФИЛЬТРЫ И ПОИСК
    // ========================
    const navigate = useNavigate();

    const [supplierFilter, setSupplierFilter] = React.useState<number | ''>('');
    const [search, setSearch] = React.useState('');
    const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);


    // ========================
    // СОСТОЯНИЕ - ДИАЛОГИ
    // ========================

    /** Диалог создания/редактирования */
    const [openCreateDialog, setOpenCreateDialog] = React.useState(false);

    /** Диалог подтверждения удаления */
    const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false);

    /** ID прайс-листа для редактирования (null = создание нового) */
    const [editingId, setEditingId] = React.useState<number | null>(null);

    /** ID прайс-листа для удаления */
    const [deletingId, setDeletingId] = React.useState<number | null>(null);

    // ========================
    // СОСТОЯНИЕ - ФОРМА
    // ========================

    const [form, setForm] = React.useState<CreateUpdateSupplierPriceListPayload>({
        supplier: 0,
        name: '',
        version: '',
        effective_date: '',
        currency: 'RUB',
        is_active: true,
    });

    const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

    const [submitError, setSubmitError] = React.useState<string | null>(null);

    // ========================
    // СОСТОЯНИЕ - API ДАННЫЕ
    // ========================

    const { data: priceLists = [], isLoading, error } = useSupplierPriceLists(
        typeof supplierFilter === 'number' ? supplierFilter : undefined,
    );

    // ========================
    // ХУКИ - MUTATIONS (ИЗМЕНЕНИЯ)
    // ========================

    const createMutation = useCreateSupplierPriceList();
    const updateMutation = useUpdateSupplierPriceList();
    const deleteMutation = useDeleteSupplierPriceList();

    const isMutationLoading =
        createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

    // ========================
    // ЭФФЕКТЫ
    // ========================

    /**
     * Загрузить список поставщиков при монтировании
     */
    React.useEffect(() => {
        const loadSuppliers = async () => {
            try {
                setLoadingSuppliers(true);
                const res = await http.get('/api/suppliers/', {
                    params: { page_size: 1000 },
                });

                const data = Array.isArray(res.data?.results) ? res.data.results : res.data;
                const supplierList: SupplierOption[] = (data || []).map((s: any) => ({
                    id: s.id,
                    name: s.name || s.title || `Поставщик #${s.id}`,
                }));

                setSuppliers(supplierList);
            } catch (err) {
                console.error('Ошибка загрузки поставщиков:', err);
            } finally {
                setLoadingSuppliers(false);
            }
        };

        loadSuppliers();
    }, []);

    // ========================
    // ФУНКЦИИ - ПОИСК И ФИЛЬТРАЦИЯ
    // ========================

    /**
     * Получить имя поставщика по ID
     */
    const getSupplierName = (supplierId: number): string => {
        const supplier = suppliers.find((s) => s.id === supplierId);
        return supplier?.name || `Поставщик #${supplierId}`;
    };

    /**
     * Отфильтровать список по поиску
     */
    const filteredRows = React.useMemo(() => {
        if (!search.trim()) return priceLists;

        const q = search.trim().toLowerCase();
        return priceLists.filter((pl) => {
            const supplierName = getSupplierName(pl.supplier);
            const searchText = `${pl.name} ${pl.version} ${pl.currency} ${supplierName}`.toLowerCase();
            return searchText.includes(q);
        });
    }, [priceLists, search, suppliers]);

    // ========================
    // ФУНКЦИИ - УПРАВЛЕНИЕ ДИАЛОГОМ СОЗДАНИЯ/РЕДАКТИРОВАНИЯ
    // ========================

    /**
     * Открыть диалог создания нового прайс-листа
     */
    const handleOpenCreateDialog = () => {
        setEditingId(null);
        setForm({
            supplier: 0,
            name: '',
            version: '',
            effective_date: '',
            currency: 'RUB',
            is_active: true,
        });
        setFormErrors({});
        setSubmitError(null);
        setOpenCreateDialog(true);
    };

    /**
     * Открыть диалог редактирования (в реальном приложении здесь нужно загрузить данные прайс-листа)
     */
    const handleOpenEditDialog = (id: number) => {
        setEditingId(id);
        // Находим данные прайс-листа в списке
        const priceList = priceLists.find((pl) => pl.id === id);
        if (priceList) {
            setForm({
                supplier: priceList.supplier,
                name: priceList.name,
                version: priceList.version,
                effective_date: priceList.effective_date,
                expiry_date: priceList.expiry_date,
                currency: priceList.currency,
                is_active: priceList.is_active,
            });
        }
        setFormErrors({});
        setSubmitError(null);
        setOpenCreateDialog(true);
    };

    /**
     * Закрыть диалог создания/редактирования
     */
    const handleCloseCreateDialog = () => {
        setOpenCreateDialog(false);
        setEditingId(null);
        setForm({
            supplier: 0,
            name: '',
            version: '',
            effective_date: '',
            currency: 'RUB',
            is_active: true,
        });
        setFormErrors({});
        setSubmitError(null);
    };

    /**
     * Валидация формы
     */
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!form.supplier) errors.supplier = 'Выберите поставщика';
        if (!form.name.trim()) errors.name = 'Название обязательно';
        if (!form.version.trim()) errors.version = 'Версия обязательна';
        if (!form.effective_date) errors.effective_date = 'Дата начала обязательна';
        if (!form.currency) errors.currency = 'Валюта обязательна';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    /**
     * Отправить форму (создание или обновление)
     */
    const handleSubmitForm = async () => {
        if (!validateForm()) return;

        setSubmitError(null);

        const extractError = (err: any): string => {
            const data = err?.response?.data;
            if (!data) return err?.message || 'Ошибка при сохранении';
            if (typeof data === 'string') return data;
            if (typeof data?.detail === 'string') return data.detail;
            try {
                const parts: string[] = [];
                Object.entries(data).forEach(([k, v]) => {
                    if (v == null) return;
                    if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
                    else parts.push(`${k}: ${String(v)}`);
                });
                return parts.join('; ') || (err?.message || 'Ошибка при сохранении');
            } catch {
                return err?.message || 'Ошибка при сохранении';
            }
        };

        try {
            if (editingId) {
                await updateMutation.mutateAsync({
                    id: editingId,
                    payload: form,
                });
            } else {
                await createMutation.mutateAsync(form);
            }
            handleCloseCreateDialog();
        } catch (err: any) {
            console.error('Ошибка при сохранении:', err);
            setSubmitError(extractError(err));
        }
    };

    // ========================
    // ФУНКЦИИ - УПРАВЛЕНИЕ ДИАЛОГОМ УДАЛЕНИЯ
    // ========================

    /**
     * Открыть диалог подтверждения удаления
     */
    const handleOpenDeleteDialog = (id: number) => {
        setDeletingId(id);
        setOpenDeleteDialog(true);
    };

    /**
     * Закрыть диалог удаления
     */
    const handleCloseDeleteDialog = () => {
        setOpenDeleteDialog(false);
        setDeletingId(null);
    };

    /**
     * Подтвердить и выполнить удаление
     */
    const handleConfirmDelete = () => {
        if (deletingId) {
            deleteMutation.mutate(deletingId);
            handleCloseDeleteDialog();
        }
    };

    // ========================
    // ФУНКЦИИ - СБРОС ФИЛЬТРОВ
    // ========================

    const handleResetFilter = () => {
        setSupplierFilter('');
        setSearch('');
    };

    // ========================
    // РЕНДЕР
    // ========================

    return (
        <Box sx={{ p: 2 }}>
            {/* ========================
          ЗАГОЛОВОК И КНОПКА СОЗДАНИЯ
          ======================== */}

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                    flexWrap: 'wrap',
                    gap: 1,
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Прайс-листы поставщиков
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleOpenCreateDialog}
                >
                    Создать прайс-лист
                </Button>
            </Box>

            {/* ========================
          КАРТОЧКА С ФИЛЬТРАМИ
          ======================== */}

            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                    >
                        {/* ФИЛЬТР ПО ПОСТАВЩИКУ */}
                        <FormControl sx={{ minWidth: 260 }} size="small" disabled={loadingSuppliers}>
                            <InputLabel id="supplier-filter-label">Поставщик</InputLabel>
                            <Select
                                labelId="supplier-filter-label"
                                label="Поставщик"
                                value={supplierFilter}
                                onChange={(e) =>
                                    setSupplierFilter(e.target.value === '' ? '' : Number(e.target.value))
                                }
                            >
                                <MenuItem value="">
                                    <em>Все поставщики</em>
                                </MenuItem>
                                {suppliers.map((s) => (
                                    <MenuItem key={s.id} value={s.id}>
                                        {s.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* ПОЛЕ ПОИСКА */}
                        <TextField
                            size="small"
                            placeholder="Поиск по названию, версии, валюте..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            sx={{ minWidth: 320, flex: 1 }}
                        />

                        {/* КНОПКА СБРОСА */}
                        <Button variant="outlined" size="small" onClick={handleResetFilter}>
                            Сбросить
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* ========================
          ОСНОВНАЯ ТАБЛИЦА
          ======================== */}

            <Card variant="outlined">
                <CardContent>
                    {/* СОСТОЯНИЕ ЗАГРУЗКИ */}
                    {isLoading ? (
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            minHeight={300}
                        >
                            <Stack alignItems="center" spacing={1}>
                                <CircularProgress />
                                <Typography variant="body2" color="text.secondary">
                                    Загрузка прайс-листов...
                                </Typography>
                            </Stack>
                        </Box>
                    ) : // СОСТОЯНИЕ ОШИБКИ
                        error ? (
                            <Box
                                sx={{
                                    p: 3,
                                    backgroundColor: 'error.light',
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'error.main',
                                }}
                            >
                                <Typography color="error" variant="body2">
                                    ❌ Ошибка: {(error as any)?.message || 'Не удалось загрузить данные'}
                                </Typography>
                            </Box>
                        ) : // ТАБЛИЦА ДАННЫХ
                            filteredRows.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography color="text.secondary">
                                        Прайс-листы не найдены.
                                        {search.trim() && ' Попробуйте изменить поисковый запрос.'}
                                    </Typography>
                                </Box>
                            ) : (
                                <Box sx={{ overflowX: 'auto' }}>
                                    <Table size="small" aria-label="Таблица прайс-листов">
                                        {/* ШАПКА ТАБЛИЦЫ */}
                                        <TableHead>
                                            <TableRow sx={{ backgroundColor: 'action.hover' }}>
                                                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Поставщик</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Название</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Версия</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Дата начала</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Дата окончания</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Валюта</TableCell>
                                                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>
                                                    Статус
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>
                                                    Действия
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>

                                        {/* ТЕЛО ТАБЛИЦЫ */}
                                        <TableBody>
                                            {filteredRows.map((pl: SupplierPriceList) => {
                                                const supplierName = getSupplierName(pl.supplier);
                                                const isActive = pl.is_active;

                                                return (
                                                    <TableRow
                                                        key={pl.id}
                                                        hover
                                                        sx={{
                                                            '&:hover': {
                                                                backgroundColor: 'action.hover',
                                                            },
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                                {pl.id}
                                                            </Typography>
                                                        </TableCell>

                                                        <TableCell>
                                                            <Typography variant="body2">{supplierName}</Typography>
                                                        </TableCell>

                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                {pl.name}
                                                            </Typography>
                                                        </TableCell>

                                                        <TableCell>
                                                            <Typography variant="body2">{pl.version}</Typography>
                                                        </TableCell>

                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {pl.effective_date
                                                                    ? new Date(pl.effective_date).toLocaleDateString('ru-RU')
                                                                    : '—'}
                                                            </Typography>
                                                        </TableCell>

                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {pl.expiry_date
                                                                    ? new Date(pl.expiry_date).toLocaleDateString('ru-RU')
                                                                    : '—'}
                                                            </Typography>
                                                        </TableCell>

                                                        <TableCell>
                                                            <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    color: 'primary.main',
                                                                    fontFamily: 'monospace',
                                                                }}
                                                            >
                                                                {pl.currency}
                                                            </Typography>
                                                        </TableCell>

                                                        <TableCell align="center">
                                                            <Chip
                                                                label={isActive ? 'Активен' : 'Неактивен'}
                                                                color={isActive ? 'success' : 'default'}
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                        </TableCell>

                                                        {/* КНОПКИ ДЕЙСТВИЙ */}
                                                        <TableCell align="center">
                                                            <Stack
                                                                direction="row"
                                                                spacing={0.5}
                                                                justifyContent="center"
                                                            >
                                                                <IconButton
                                                                    size="small"
                                                                    color="info"
                                                                    onClick={() => navigate(`/price-lists/${pl.id}`)}
                                                                    title="Просмотр товаров в прайс-листе"
                                                                >
                                                                    <VisibilityIcon fontSize="small" />
                                                                </IconButton>

                                                                <IconButton
                                                                    size="small"
                                                                    color="primary"
                                                                    onClick={() => handleOpenEditDialog(pl.id)}
                                                                    title="Редактировать"
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>

                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => handleOpenDeleteDialog(pl.id)}
                                                                    title="Удалить"
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </Box>
                            )}

                    {/* ИНФОРМАЦИЯ О КОЛИЧЕСТВЕ ЗАПИСЕЙ */}
                    {!isLoading && !error && filteredRows.length > 0 && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.secondary">
                                Показано: <strong>{filteredRows.length}</strong> прайс-листов
                                {supplierFilter !== '' && (
                                    <>
                                        {' '}
                                        от <strong>{getSupplierName(supplierFilter as number)}</strong>
                                    </>
                                )}
                                {search.trim() && (
                                    <>
                                        {' '}
                                        (поиск по: "<strong>{search}</strong>")
                                    </>
                                )}
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ========================
          ДИАЛОГ СОЗДАНИЯ/РЕДАКТИРОВАНИЯ
          ======================== */}

            <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingId ? 'Редактировать прайс-лист' : 'Создать прайс-лист'}
                </DialogTitle>

                <DialogContent sx={{ pt: 2 }}>
                    <Stack spacing={2}>
                        {/* ОШИБКИ */}
                        {submitError ? <Alert severity="error">{submitError}</Alert> : null}

                        {/* ВЫБОР ПОСТАВЩИКА */}
                        <FormControl fullWidth error={!!formErrors.supplier}>
                            <InputLabel>Поставщик *</InputLabel>
                            <Select
                                label="Поставщик *"
                                value={form.supplier}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        supplier: Number(e.target.value),
                                    }))
                                }
                            >
                                <MenuItem value={0}>
                                    <em>Выберите поставщика</em>
                                </MenuItem>
                                {suppliers.map((s) => (
                                    <MenuItem key={s.id} value={s.id}>
                                        {s.name}
                                    </MenuItem>
                                ))}
                            </Select>
                            {formErrors.supplier && (
                                <Typography variant="caption" sx={{ color: 'error.main' }}>
                                    {formErrors.supplier}
                                </Typography>
                            )}
                        </FormControl>

                        {/* НАЗВАНИЕ */}
                        <TextField
                            label="Название прайс-листа *"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            fullWidth
                            error={!!formErrors.name}
                            helperText={formErrors.name}
                            placeholder="Например: Q1 2026 Прайс"
                        />

                        {/* ВЕРСИЯ */}
                        <TextField
                            label="Версия *"
                            value={form.version}
                            onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                            fullWidth
                            error={!!formErrors.version}
                            helperText={formErrors.version}
                            placeholder="Например: 1.0"
                        />

                        {/* ДАТА НАЧАЛА */}
                        <TextField
                            label="Дата начала действия *"
                            type="date"
                            value={form.effective_date}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, effective_date: e.target.value }))
                            }
                            fullWidth
                            error={!!formErrors.effective_date}
                            helperText={formErrors.effective_date}
                            InputLabelProps={{ shrink: true }}
                        />

                        {/* ДАТА ОКОНЧАНИЯ */}
                        <TextField
                            label="Дата окончания (опционально)"
                            type="date"
                            value={form.expiry_date || ''}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, expiry_date: e.target.value }))
                            }
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                        />

                        {/* ВАЛЮТА */}
                        <FormControl fullWidth error={!!formErrors.currency}>
                            <InputLabel>Валюта *</InputLabel>
                            <Select
                                label="Валюта *"
                                value={form.currency}
                                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                            >
                                <MenuItem value="RUB">RUB (Рубли)</MenuItem>
                                <MenuItem value="USD">USD (Доллары)</MenuItem>
                                <MenuItem value="EUR">EUR (Евро)</MenuItem>
                                <MenuItem value="CNY">CNY (Юани)</MenuItem>
                            </Select>
                            {formErrors.currency && (
                                <Typography variant="caption" sx={{ color: 'error.main' }}>
                                    {formErrors.currency}
                                </Typography>
                            )}
                        </FormControl>

                        {/* АКТИВНОСТЬ */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={form.is_active || false}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                                    }
                                />
                            }
                            label="Прайс-лист активен"
                        />
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleCloseCreateDialog} disabled={isMutationLoading}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleSubmitForm}
                        variant="contained"
                        disabled={isMutationLoading}
                    >
                        {isMutationLoading && <CircularProgress size={20} sx={{ mr: 1 }} />}
                        {editingId ? 'Сохранить' : 'Создать'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ========================
          ДИАЛОГ ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ
          ======================== */}

            <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Удалить прайс-лист?</DialogTitle>
                <DialogContent>
                    Это действие нельзя отменить. Вы уверены, что хотите удалить этот прайс-лист?
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog} disabled={isMutationLoading}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                        disabled={isMutationLoading}
                    >
                        {isMutationLoading && <CircularProgress size={20} sx={{ mr: 1 }} />}
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
