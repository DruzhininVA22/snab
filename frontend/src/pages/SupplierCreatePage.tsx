/**
 * Создание поставщика.
 *
 * Форма добавления записи в справочник поставщиков SNAB.
 *
 * ВАЖНО: payload соответствует SupplierWriteSerializer на бэкенде:
 * {
 *   name, inn, activity, address, status, rating, is_active, notes,
 *   categories: number[],
 *   contacts: ContactRow[],
 *   terms: TermState
 * }
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
import { useNavigate } from 'react-router-dom';
import { http, fixPath } from '../api/_http';

const API_BASE = '/api/suppliers/';

type ContactRow = {
  person_name: string;
  position: string;
  phone: string;
  email: string;
  comment: string;
};

type TermState = {
  payment_terms: string;
  min_order_amount: string;
  lead_time_days: string; // храним строкой, на бэке превратится в число
  delivery_regions: string;
  delivery_notes: string;
};

type CategoryOption = { id: number; label: string };

export default function SupplierCreatePage() {
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

  const nav = useNavigate();

  // основные поля поставщика
  const [name, setName] = React.useState('');
  const [inn, setInn] = React.useState('');
  const [activity, setActivity] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [rating, setRating] = React.useState<number>(3);
  const [status, setStatus] = React.useState<string>('regular');
  const [notes, setNotes] = React.useState('');

  // категории поставок
  const [categoriesOptions, setCategoriesOptions] = React.useState<CategoryOption[]>([]);
  const [categoryIds, setCategoryIds] = React.useState<number[]>([]);

  // контакты
  const [contacts, setContacts] = React.useState<ContactRow[]>([
    { person_name: '', position: '', phone: '', email: '', comment: '' },
  ]);

  // условия поставки
  const [terms, setTerms] = React.useState<TermState>({
    payment_terms: '',
    min_order_amount: '',
    lead_time_days: '',
    delivery_regions: '',
    delivery_notes: '',
  });

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // загрузка категорий (мультивыбор)
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
          // пробуем следующий URL
        }
      }
    })();
  }, []);

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      { person_name: '', position: '', phone: '', email: '', comment: '' },
    ]);
  };
  const delContact = (idx: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSave = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // приводим contacts и terms к формату, который ждёт бэкенд
      const cleanedContacts = contacts
        .map((c) => ({
          person_name: c.person_name.trim(),
          position: c.position.trim(),
          phone: c.phone.trim(),
          email: c.email.trim(),
          comment: c.comment.trim(),
        }))
        // отбрасываем полностью пустые контакты
        .filter(
          (c) =>
            c.person_name ||
            c.position ||
            c.phone ||
            c.email ||
            c.comment,
        );

      const leadDays = terms.lead_time_days.trim();
      const payload: any = {
        name: name.trim(),
        inn: inn.trim() || null,
        activity: activity.trim(),
        address: address.trim(),
        status,
        rating,
        is_active: isActive,
        notes: notes.trim(),
        categories: categoryIds,
      };

      if (cleanedContacts.length) {
        payload.contacts = cleanedContacts;
      }

      if (
        terms.payment_terms ||
        terms.min_order_amount ||
        terms.delivery_regions ||
        terms.delivery_notes ||
        leadDays
      ) {
        payload.terms = {
          payment_terms: terms.payment_terms.trim(),
          min_order_amount: terms.min_order_amount.trim(),
          delivery_regions: terms.delivery_regions.trim(),
          delivery_notes: terms.delivery_notes.trim(),
          lead_time_days: leadDays ? Number(leadDays) : null,
        };
      }

      const url = fixPath(`${API_BASE}`);
      await http.post(url, payload);
      nav(fixPath('/suppliers'));
    } catch (e: any) {
      alert(e?.message || 'Ошибка сохранения поставщика');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={pageSx}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Новый поставщик
          </Typography>

          {/* Основные поля */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Название поставщика"
              size="small"
              fullWidth
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label="ИНН / рег. номер"
              size="small"
              fullWidth
              value={inn}
              onChange={(e) => setInn(e.target.value)}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Основная деятельность"
              size="small"
              fullWidth
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            />
            <TextField
              label="Адрес"
              size="small"
              fullWidth
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="status-label">Статус допуска</InputLabel>
              <Select
                labelId="status-label"
                label="Статус допуска"
                value={status}
                onChange={(e) => setStatus(e.target.value as string)}
              >
                <MenuItem value="preferred">Предпочитаемый</MenuItem>
                <MenuItem value="regular">Обычный</MenuItem>
                <MenuItem value="blocked">Блокирован</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Рейтинг (0–5)"
              size="small"
              type="number"
              inputProps={{ min: 0, max: 5, step: 1 }}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value) || 0)}
              sx={{ width: 140 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label="Активен"
            />
          </Stack>

          {/* Категории */}
          <Stack direction="column" spacing={1} sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Категории поставляемых материалов</Typography>
            <FormControl size="small" fullWidth>
              <InputLabel id="cats-label">Категории</InputLabel>
              <Select
                labelId="cats-label"
                label="Категории"
                multiple
                value={categoryIds}
                onChange={(e) =>
                  setCategoryIds(
                    typeof e.target.value === 'string'
                      ? e.target.value.split(',').map((v) => Number(v))
                      : (e.target.value as number[]),
                  )
                }
                renderValue={(selected) =>
                  categoriesOptions
                    .filter((c) => selected.includes(c.id))
                    .map((c) => c.label)
                    .join(', ') || 'Не выбрано'
                }
              >
                {categoriesOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Условия поставки */}
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Условия поставки и оплаты
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Условия оплаты"
              size="small"
              fullWidth
              value={terms.payment_terms}
              onChange={(e) =>
                setTerms((t) => ({ ...t, payment_terms: e.target.value }))
              }
            />
            <TextField
              label="Минимальный заказ"
              size="small"
              fullWidth
              value={terms.min_order_amount}
              onChange={(e) =>
                setTerms((t) => ({ ...t, min_order_amount: e.target.value }))
              }
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Срок поставки (дней)"
              size="small"
              type="number"
              inputProps={{ min: 0 }}
              value={terms.lead_time_days}
              onChange={(e) =>
                setTerms((t) => ({ ...t, lead_time_days: e.target.value }))
              }
            />
            <TextField
              label="Регионы поставки"
              size="small"
              fullWidth
              value={terms.delivery_regions}
              onChange={(e) =>
                setTerms((t) => ({ ...t, delivery_regions: e.target.value }))
              }
            />
          </Stack>
          <TextField
            label="Логистика / доставка"
            size="small"
            fullWidth
            multiline
            minRows={2}
            sx={{ mb: 2 }}
            value={terms.delivery_notes}
            onChange={(e) =>
              setTerms((t) => ({ ...t, delivery_notes: e.target.value }))
            }
          />

          {/* Контакты */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2">Контакты</Typography>
            <Button
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={addContact}
            >
              Добавить контакт
            </Button>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ФИО</TableCell>
                <TableCell>Должность / роль</TableCell>
                <TableCell>Телефон</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Комментарий</TableCell>
                <TableCell width={40} />
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((c, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={c.person_name}
                      onChange={(e) =>
                        setContacts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, person_name: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={c.position}
                      onChange={(e) =>
                        setContacts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, position: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={c.phone}
                      onChange={(e) =>
                        setContacts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, phone: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={c.email}
                      onChange={(e) =>
                        setContacts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, email: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={c.comment}
                      onChange={(e) =>
                        setContacts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, comment: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => delContact(idx)}
                      disabled={contacts.length === 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Заметки и кнопки */}
          <TextField
            label="Заметки"
            size="small"
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 2, mb: 2 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={() => nav(fixPath('/suppliers'))}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!canSave}
            >
              Сохранить
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
