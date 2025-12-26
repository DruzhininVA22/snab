/**
 * Редактирование поставщика.
 *
 * Форма изменения реквизитов/атрибутов поставщика.
 */
import * as React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    LinearProgress,
    Button,
    TextField,
    Stack,
    Checkbox,
    FormControlLabel,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useParams, useNavigate } from 'react-router-dom';
import { http, fixPath } from '../api/_http';

const API_BASE = '/api/suppliers/';

type ContactRow = {
    id?: number;
    person_name: string;
    position: string;
    phone: string;
    email: string;
    comment: string;
};

type TermState = {
    payment_terms: string;
    min_order_amount: string;
    lead_time_days: string;
    delivery_regions: string;
    delivery_notes: string;
};

type CategoryOption = { id: number; label: string };

export default function SupplierEditPage() {
    const pageSx = {
        px: 1,
        mx: -1,
        fontSize: '0.875rem',
        lineHeight: 1.35,
        '& .MuiTypography-root': { fontSize: '0.875rem' },
        '& .MuiButton-root, & .MuiInputBase-root, & .MuiSelect-select, & .MuiMenuItem-root': {
            fontSize: '0.875rem',
        },
        '& .MuiTableCell-root': { fontSize: '0.8125rem' },
        '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
    } as const;

    const { id } = useParams();
    const nav = useNavigate();

    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // основные данные
    const [name, setName] = React.useState('');
    const [inn, setInn] = React.useState('');
    const [activity, setActivity] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [isActive, setIsActive] = React.useState(true);
    const [rating, setRating] = React.useState<number>(3);
    const [status, setStatus] = React.useState<string>('regular');
    const [notes, setNotes] = React.useState('');

    // категории
    const [categoriesOptions, setCategoriesOptions] = React.useState<CategoryOption[]>([]);
    const [categoryIds, setCategoryIds] = React.useState<number[]>([]);

    // контакты
    const [contacts, setContacts] = React.useState<ContactRow[]>([]);

    // условия
    const [terms, setTerms] = React.useState<TermState>({
        payment_terms: '',
        min_order_amount: '',
        lead_time_days: '',
        delivery_regions: '',
        delivery_notes: '',
    });

    // загрузка списка категорий для мультивыбора
    React.useEffect(() => {
        (async () => {
            const tryUrls = [
                fixPath('/api/catalog/categories/?page_size=1000'),
                fixPath('/api/categories/?page_size=1000'),
                fixPath('/api/core/categories/?page_size=1000'),
            ];
            for (const url of tryUrls) {
                try {
                    const { data } = await http.get(url);
                    const raw = Array.isArray(data)
                        ? data
                        : Array.isArray(data?.results)
                            ? data.results
                            : [];
                    if (raw.length) {
                        const opts = raw.map((c: any) => ({
                            id: c.id,
                            label: (
                                ((c.code ? c.code + ' ' : '') +
                                    (c.name || c.title || 'без имени')) as string
                            ).trim(),
                        }));
                        setCategoriesOptions(opts);
                        return;
                    }
                } catch {
                    /* пробуем след. endpoint */
                }
            }
        })();
    }, []);

    // загрузка текущего поставщика
    React.useEffect(() => {
        setLoading(true);
        http
            .get(fixPath(`${API_BASE}${id}/`))
            .then(({ data }) => {
                setName(data.name || '');
                setInn(data.inn || '');
                setActivity(data.activity || '');
                setAddress(data.address || '');
                setIsActive(!!data.is_active);
                setRating(Number(data.rating ?? 0));
                setStatus(data.status || 'regular');
                setNotes(data.notes || '');

                setCategoryIds(
                    Array.isArray(data.categories)
                        ? data.categories.map((c: any) => c.id)
                        : []
                );

                setContacts(
                    Array.isArray(data.contacts)
                        ? data.contacts.map((c: any) => ({
                            id: c.id,
                            person_name: c.person_name || '',
                            position: c.position || '',
                            phone: c.phone || '',
                            email: c.email || '',
                            comment: c.comment || '',
                        }))
                        : []
                );

                setTerms({
                    payment_terms: data.terms?.payment_terms || '',
                    min_order_amount: data.terms?.min_order_amount || '',
                    lead_time_days:
                        data.terms?.lead_time_days != null
                            ? String(data.terms.lead_time_days)
                            : '',
                    delivery_regions: data.terms?.delivery_regions || '',
                    delivery_notes: data.terms?.delivery_notes || '',
                });
            })
            .finally(() => setLoading(false));
    }, [id]);

    const addContact = () => {
        setContacts((prev) => [
            ...prev,
            {
                person_name: '',
                position: '',
                phone: '',
                email: '',
                comment: '',
            },
        ]);
    };
    const delContact = (idx: number) => {
        setContacts((prev) => prev.filter((_, i) => i !== idx));
    };

    const canSave = !!name.trim();

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const payload: any = {
                name,
                inn,
                activity,
                address,
                is_active: isActive,
                rating,
                status,
                notes,
                categories: categoryIds,
                contacts: contacts
                    .filter(
                        (c) =>
                            c.person_name.trim() ||
                            c.phone.trim() ||
                            c.email.trim()
                    )
                    .map((c) => ({
                        person_name: c.person_name,
                        position: c.position,
                        phone: c.phone,
                        email: c.email,
                        comment: c.comment,
                    })),
                terms: {
                    payment_terms: terms.payment_terms,
                    min_order_amount: terms.min_order_amount,
                    lead_time_days: terms.lead_time_days
                        ? Number(terms.lead_time_days)
                        : null,
                    delivery_regions: terms.delivery_regions,
                    delivery_notes: terms.delivery_notes,
                },
            };

            await http.patch(fixPath(`${API_BASE}${id}/`), payload);
            nav('/suppliers');
        } catch {
            alert('Не удалось сохранить поставщика');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <Card>
                {loading && <LinearProgress />}
                <CardContent>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 2 }}
                    >
                        <Typography variant="h6">Поставщик №{id}</Typography>
                        <Stack direction="row" spacing={1}>
                            <Button onClick={save} variant="contained" disabled={!canSave || saving}>
                                Сохранить
                            </Button>
                            <Button onClick={() => nav('/suppliers')}>Отмена</Button>
                        </Stack>
                    </Stack>

                    {/* Основные реквизиты */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            label="Название *"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            sx={{ flex: 1, minWidth: 240 }}
                        />
                        <TextField
                            size="small"
                            label="ИНН / рег. номер"
                            value={inn}
                            onChange={(e) => setInn(e.target.value)}
                            sx={{ flex: 1, minWidth: 160 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel id="status">Статус</InputLabel>
                            <Select
                                labelId="status"
                                label="Статус"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as string)}
                            >
                                <MenuItem value="preferred">Предпочитаемый</MenuItem>
                                <MenuItem value="regular">Обычный</MenuItem>
                                <MenuItem value="blocked">Блокирован</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            size="small"
                            type="number"
                            label="Рейтинг (0..5)"
                            value={rating}
                            inputProps={{ min: 0, max: 5, step: 1 }}
                            onChange={(e) => setRating(Number(e.target.value))}
                            sx={{ width: 120 }}
                        />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            label="Основная деятельность"
                            value={activity}
                            onChange={(e) => setActivity(e.target.value)}
                            sx={{ flex: 1, minWidth: 240 }}
                        />
                        <TextField
                            size="small"
                            label="Адрес"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            sx={{ flex: 1, minWidth: 240 }}
                        />
                    </Stack>

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                            />
                        }
                        label="Активен"
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        size="small"
                        label="Заметки / Описание"
                        multiline
                        minRows={2}
                        fullWidth
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        sx={{ mb: 2 }}
                    />

                    {/* Категории поставок */}
                    <FormControl size="small" fullWidth sx={{ mb: 3 }}>
                        <InputLabel id="cats">Категории поставок</InputLabel>
                        <Select
                            labelId="cats"
                            multiple
                            value={categoryIds}
                            label="Категории поставок"
                            onChange={(e) => {
                                const val = e.target.value as number[];
                                setCategoryIds(val);
                            }}
                            renderValue={(selected) => {
                                const map = new Map(categoriesOptions.map((o) => [o.id, o.label]));
                                return (selected as number[])
                                    .map((id) => map.get(id) || id)
                                    .join(', ');
                            }}
                        >
                            {categoriesOptions.map((opt) => (
                                <MenuItem key={opt.id} value={opt.id}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Контакты */}
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 1 }}
                    >
                        <Typography variant="subtitle1">Контакты</Typography>
                        <Button startIcon={<AddIcon />} onClick={addContact}>
                            Добавить контакт
                        </Button>
                    </Stack>

                    <Table size="small" sx={{ mb: 3 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Контакт</TableCell>
                                <TableCell>Роль</TableCell>
                                <TableCell>Телефон</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Комментарий</TableCell>
                                <TableCell sx={{ width: 40 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {contacts.map((c, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            value={c.person_name}
                                            onChange={(e) =>
                                                setContacts((prev) =>
                                                    prev.map((r, i) =>
                                                        i === idx ? { ...r, person_name: e.target.value } : r
                                                    )
                                                )
                                            }
                                            placeholder="ФИО"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            value={c.position}
                                            onChange={(e) =>
                                                setContacts((prev) =>
                                                    prev.map((r, i) =>
                                                        i === idx ? { ...r, position: e.target.value } : r
                                                    )
                                                )
                                            }
                                            placeholder="Роль"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            value={c.phone}
                                            onChange={(e) =>
                                                setContacts((prev) =>
                                                    prev.map((r, i) =>
                                                        i === idx ? { ...r, phone: e.target.value } : r
                                                    )
                                                )
                                            }
                                            placeholder="+7..."
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            value={c.email}
                                            onChange={(e) =>
                                                setContacts((prev) =>
                                                    prev.map((r, i) =>
                                                        i === idx ? { ...r, email: e.target.value } : r
                                                    )
                                                )
                                            }
                                            placeholder="mail@..."
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            value={c.comment}
                                            onChange={(e) =>
                                                setContacts((prev) =>
                                                    prev.map((r, i) =>
                                                        i === idx ? { ...r, comment: e.target.value } : r
                                                    )
                                                )
                                            }
                                            placeholder="Как лучше связаться"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton onClick={() => delContact(idx)} size="small">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Условия поставки */}
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Условия поставки / оплаты
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            label="Условия оплаты"
                            value={terms.payment_terms}
                            onChange={(e) =>
                                setTerms((t) => ({ ...t, payment_terms: e.target.value }))
                            }
                            sx={{ flex: 1, minWidth: 240 }}
                        />
                        <TextField
                            size="small"
                            label="Мин. заказ"
                            value={terms.min_order_amount}
                            onChange={(e) =>
                                setTerms((t) => ({ ...t, min_order_amount: e.target.value }))
                            }
                            sx={{ flex: 1, minWidth: 160 }}
                        />
                        <TextField
                            size="small"
                            label="Срок поставки (дн.)"
                            type="number"
                            value={terms.lead_time_days}
                            onChange={(e) =>
                                setTerms((t) => ({ ...t, lead_time_days: e.target.value }))
                            }
                            sx={{ width: 160 }}
                        />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            label="Регионы поставки"
                            value={terms.delivery_regions}
                            onChange={(e) =>
                                setTerms((t) => ({ ...t, delivery_regions: e.target.value }))
                            }
                            sx={{ flex: 1, minWidth: 240 }}
                        />
                        <TextField
                            size="small"
                            label="Доставка / логистика"
                            value={terms.delivery_notes}
                            onChange={(e) =>
                                setTerms((t) => ({ ...t, delivery_notes: e.target.value }))
                            }
                            sx={{ flex: 1, minWidth: 240 }}
                        />
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}
