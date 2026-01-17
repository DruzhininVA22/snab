/**
 * SupplierEditPage.tsx
 * 
 * Форма редактирования поставщика.
 * 
 * Отличия от SupplierCreatePage:
 * - загрузка существующих данных при открытии
 * - отправка на PATCH вместо POST
 * - предзаполнение всех полей
 */

import * as React from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress, Button, TextField, Stack,
  Checkbox, FormControlLabel, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useParams, useNavigate } from 'react-router-dom';
import { http, fixPath } from '../../api/_http';
import CategoryTreeSelect from '../../components/CategoryTreeSelect';

// ============================================================
// ТИПЫ ДАННЫХ
// ============================================================

type ContactRow = {
  id?: number;
  personName: string;
  position: string;
  phone: string;
  email: string;
  comment: string;
};

type TermState = {
  paymentTerms: string;
  minOrderAmount: string;
  leadTimeDays: string;
  deliveryRegions: string;
  deliveryNotes: string;
};

// ============================================================
// КОМПОНЕНТ
// ============================================================

export default function SupplierEditPage() {
  // === МАРШРУТ ===
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  // === СТИЛИ ===
  const pageSx = {
    px: 1, mx: -1, fontSize: '0.875rem', lineHeight: 1.35,
    '& .MuiTypography-root': { fontSize: '0.875rem' },
    '& .MuiButton-root, & .MuiInputBase-root, & .MuiSelect-select, & .MuiMenuItem-root': { fontSize: '0.875rem' },
    '& .MuiTableCell-root': { fontSize: '0.8125rem' },
    '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
  } as const;

  // === СОСТОЯНИЕ ===
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState('');
  const [inn, setInn] = React.useState('');
  const [activity, setActivity] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [rating, setRating] = React.useState<number>(3);
  const [status, setStatus] = React.useState<string>('regular');
  const [notes, setNotes] = React.useState('');

  const [categoryIds, setCategoryIds] = React.useState<number[]>([]);

  const [contacts, setContacts] = React.useState<ContactRow[]>([]);

  const [terms, setTerms] = React.useState<TermState>({
    paymentTerms: '',
    minOrderAmount: '',
    leadTimeDays: '',
    deliveryRegions: '',
    deliveryNotes: '',
  });

  // === ЭФФЕКТ: ЗАГРУЗКА ДАННЫХ ПОСТАВЩИКА ===
  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data } = await http.get(fixPath(`/api/suppliers/${id}/`));

        // Заполняем базовые поля
        setName(data.name);
        setInn(data.inn);
        setActivity(data.activity);
        setAddress(data.address);
        setIsActive(!!data.is_active);
        setRating(Number(data.rating ?? 0));
        setStatus(data.status || 'regular');
        setNotes(data.notes);

        // Заполняем категории
        setCategoryIds(Array.isArray(data.categories) ? data.categories.map((c: any) => c.id || c) : []);

        // Заполняем контакты
        setContacts(
          Array.isArray(data.contacts)
            ? data.contacts.map((c: any) => ({
              id: c.id,
              personName: c.person_name || '',
              position: c.position || '',
              phone: c.phone || '',
              email: c.email || '',
              comment: c.comment || '',
            }))
            : []
        );

        // Заполняем условия поставки
        setTerms({
          paymentTerms: data.terms?.payment_terms || '',
          minOrderAmount: data.terms?.min_order_amount || '',
          leadTimeDays: data.terms?.lead_time_days != null ? String(data.terms.lead_time_days) : '',
          deliveryRegions: data.terms?.delivery_regions || '',
          deliveryNotes: data.terms?.delivery_notes || '',
        });
      } finally {
        setLoading(false);
      }
    }

    if (id) loadData();
  }, [id]);

  // === ОБРАБОТЧИКИ ===
  const addContact = () => {
    setContacts((prev) => [...prev, { personName: '', position: '', phone: '', email: '', comment: '' }]);
  };

  const delContact = (idx: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSave = !!name.trim();

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
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
          .filter((c) => c.personName?.trim() || c.phone?.trim() || c.email?.trim())
          .map((c) => ({
            person_name: c.personName,
            position: c.position,
            phone: c.phone,
            email: c.email,
            comment: c.comment,
          })),
        terms: {
          payment_terms: terms.paymentTerms,
          min_order_amount: terms.minOrderAmount,
          lead_time_days: terms.leadTimeDays ? Number(terms.leadTimeDays) : null,
          delivery_regions: terms.deliveryRegions,
          delivery_notes: terms.deliveryNotes,
        },
      };
      await http.patch(fixPath(`/api/suppliers/${id}/`), payload);
      nav('/reference/suppliers');
    } catch (e: any) {
      alert(`Ошибка: ${e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  // === РЕНДЕР ===
  return (
    <Box sx={pageSx}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Редактирование поставщика (ID: {id})</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={save} variant="contained" disabled={!canSave || saving}>
                Сохранить
              </Button>
              <Button onClick={() => nav('/reference/suppliers')}>
                Отмена
              </Button>
            </Stack>
          </Stack>

          {/* === БАЗОВЫЕ ПОЛЯ (как в Create) === */}
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
              label="ИНН"
              value={inn}
              onChange={(e) => setInn(e.target.value)}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="status-label">Статус</InputLabel>
              <Select
                labelId="status-label"
                value={status}
                label="Статус"
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
              label="Деятельность"
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
            control={<Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Активен"
            sx={{ mb: 2 }}
          />

          <TextField
            size="small"
            label="Заметки"
            multiline
            minRows={2}
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* === КАТЕГОРИИ (MULTIPLE) === */}
          <FormControl size="small" fullWidth sx={{ mb: 3 }}>
            <CategoryTreeSelect
              multiple={true}
              value={categoryIds}
              onChange={(ids) => setCategoryIds(Array.isArray(ids) ? ids : [])}
              label="Категории товаров"
            />
          </FormControl>

          {/* === КОНТАКТЫ (как в Create) === */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">Контакты</Typography>
            <Button startIcon={<AddIcon />} onClick={addContact}>
              Добавить
            </Button>
          </Stack>
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>ФИО</TableCell>
                <TableCell>Должность</TableCell>
                <TableCell>Телефон</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Комментарий</TableCell>
                <TableCell sx={{ width: 40 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((c, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.personName}
                      onChange={(e) => setContacts((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, personName: e.target.value } : r)
                      )}
                      placeholder="ФИО"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.position}
                      onChange={(e) => setContacts((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, position: e.target.value } : r)
                      )}
                      placeholder="Должность"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.phone}
                      onChange={(e) => setContacts((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, phone: e.target.value } : r)
                      )}
                      placeholder="Телефон"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.email}
                      onChange={(e) => setContacts((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, email: e.target.value } : r)
                      )}
                      placeholder="Email"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.comment}
                      onChange={(e) => setContacts((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, comment: e.target.value } : r)
                      )}
                      placeholder="Примечание"
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

          {/* === УСЛОВИЯ ПОСТАВКИ (как в Create) === */}
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Условия поставки и оплаты
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Условия оплаты"
              value={terms.paymentTerms}
              onChange={(e) => setTerms((t) => ({ ...t, paymentTerms: e.target.value }))}
              sx={{ flex: 1, minWidth: 240 }}
            />
            <TextField
              size="small"
              label="Минимальный заказ"
              value={terms.minOrderAmount}
              onChange={(e) => setTerms((t) => ({ ...t, minOrderAmount: e.target.value }))}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <TextField
              size="small"
              label="Срок поставки (дн.)"
              type="number"
              value={terms.leadTimeDays}
              onChange={(e) => setTerms((t) => ({ ...t, leadTimeDays: e.target.value }))}
              sx={{ width: 160 }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Регионы доставки"
              value={terms.deliveryRegions}
              onChange={(e) => setTerms((t) => ({ ...t, deliveryRegions: e.target.value }))}
              sx={{ flex: 1, minWidth: 240 }}
            />
            <TextField
              size="small"
              label="Заметки о доставке"
              value={terms.deliveryNotes}
              onChange={(e) => setTerms((t) => ({ ...t, deliveryNotes: e.target.value }))}
              sx={{ flex: 1, minWidth: 240 }}
            />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
