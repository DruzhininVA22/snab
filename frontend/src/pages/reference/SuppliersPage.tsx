/**
 * Страница "Поставщики" (финальная версия).
 *
 * Структура:
 * - Левая колонка (xs=4): только список поставщиков
 * - Правая колонка (xs=8):
 *   - сверху: фильтры (Новый, Поиск, Статус) + Фильтр по категориям
 *   - снизу: детальная карточка выбранного поставщика
 */

import * as React from 'react';
import {
  Box,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  TextField,
  Stack,
} from '@mui/material';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { http, fixPath } from '../../api/_http';
import CategoryTreeSelect from '../../components/CategoryTreeSelect';

// ============================================
// ТИПЫ ДАННЫХ
// ============================================

/** Строка в списке поставщиков */
type SupplierRow = {
  id: number;
  name: string;
  activity?: string;
  status?: string;
  statuslabel?: string;
  rating?: number;
  is_active?: boolean;
  mainregion?: string;
  paymentterms?: string;
  categories_short?: string;
};

/** Контактная информация поставщика */
type SupplierContact = {
  id: number;
  person_name: string;
  position?: string;
  phone?: string;
  email?: string;
  comment?: string;
};

/** Условия поставки поставщика */
type SupplierTerms = {
  payment_terms?: string;
  min_order_amount?: string;
  lead_time_days?: number;
  delivery_regions?: string;
  delivery_notes?: string;
};

/** Краткая информация о прайс-листе */
type SupplierPriceListSummary = {
  id: number;
  title: string;
  valid_from?: string;
  currency?: string;
  comment?: string;
};

/** Полная информация о поставщике (детальная карточка) */
type SupplierDetail = {
  id: number;
  name: string;
  inn?: string | null;
  activity?: string | null;
  address?: string | null;
  is_active?: boolean;
  rating?: number;
  status?: string | null;
  statuslabel?: string | null;
  notes?: string | null;
  categories?: number[];
  categories_short?: string;
  contacts?: SupplierContact[];
  terms?: SupplierTerms;
  pricelists?: SupplierPriceListSummary[];
  created_at?: string;
  updated_at?: string;
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/** Форматирование даты из ISO формата в ДД.МММ.ГГГГ */
function fmtDate(d?: string | null): string {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  } catch {
    return d ?? '';
  }
}

/** Преобразование кода статуса в человекочитаемый формат */
function renderStatus(s?: string | null): string {
  if (!s) return '';
  switch (s) {
    case 'preferred':
      return 'Предпочитаемый';
    case 'regular':
      return 'Обычный';
    case 'blocked':
      return 'Блокирован';
    default:
      return s;
  }
}

// ============================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================

export default function SuppliersPage() {
  // Стили для всей страницы (уменьшенный шрифт)
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

  // ============================================
  // STATE: Список и фильтры
  // ============================================

  /** Список поставщиков */
  const [list, setList] = React.useState<SupplierRow[]>([]);
  /** Флаг загрузки списка */
  const [loadingList, setLoadingList] = React.useState(false);
  /** Ошибка при загрузке списка */
  const [errList, setErrList] = React.useState<string | null>(null);

  /** Поле поиска по названию */
  const [search, setSearch] = React.useState('');
  /** Фильтр по статусу (preferred/regular/blocked) */
  const [statusFilter, setStatusFilter] = React.useState<string | 'all'>('all');
  /** Фильтр по категориям (массив ID) */
  const [categoryFilter, setCategoryFilter] = React.useState<number[]>([]);

  // ============================================
  // STATE: Выбранный поставщик и деталки
  // ============================================

  /** ID выбранного поставщика */
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  /** Детальная информация о выбранном поставщике */
  const [detail, setDetail] = React.useState<SupplierDetail | null>(null);
  /** Флаг загрузки деталей */
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // ============================================
  // EFFECT: Загрузка списка поставщиков
  // ============================================

  /** Загружается при изменении фильтров (search, statusFilter, categoryFilter) */
  React.useEffect(() => {
    const loadListFn = async () => {
      setLoadingList(true);
      setErrList(null);
      try {
        // Формируем параметры запроса
        const params: string[] = ['page_size=200', 'ordering=name'];

        // Добавляем поиск
        if (search.trim()) {
          params.push(`search=${encodeURIComponent(search.trim())}`);
        }

        // Добавляем фильтр по статусу
        if (statusFilter !== 'all') {
          params.push(`status=${encodeURIComponent(statusFilter)}`);
        }

        // Добавляем фильтры по категориям (может быть несколько)
        if (categoryFilter.length > 0) {
          categoryFilter.forEach(catId => {
            params.push(`categories=${catId}`);
          });
        }

        // Отправляем запрос к API
        const url = fixPath(`/api/suppliers/?${params.join('&')}`);
        const { data } = await http.get(url);

        // Распаковываем результаты
        const rows: SupplierRow[] = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];

        setList(rows);

        // Автоматически выбираем первого поставщика в новом списке,
        // если текущий выбранный не найден
        if (rows.length > 0 && (!selectedId || !rows.find((r) => r.id === selectedId))) {
          setSelectedId(rows[0].id);
        } else if (rows.length === 0) {
          setSelectedId(null);
        }
      } catch (e: any) {
        setErrList(e?.message || 'Ошибка загрузки');
      } finally {
        setLoadingList(false);
      }
    };

    loadListFn();
  }, [search, statusFilter, categoryFilter, selectedId]);

  // ============================================
  // EFFECT: Загрузка деталей выбранного поставщика
  // ============================================

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    setLoadingDetail(true);
    let alive = true; // Флаг для отмены запроса при размонтировании

    http
      .get(fixPath(`/api/suppliers/${selectedId}/`))
      .then(({ data }) => {
        if (alive) setDetail(data as SupplierDetail);
      })
      .catch(() => {
        if (alive) setDetail(null);
      })
      .finally(() => {
        if (alive) setLoadingDetail(false);
      });

    // Cleanup: отменяем обновление состояния если компонент размонтирован
    return () => {
      alive = false;
    };
  }, [selectedId]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <Box sx={pageSx}>
      <Grid container spacing={2}>
        {/* ====== ЛЕВАЯ КОЛОНКА: СПИСОК ПОСТАВЩИКОВ ====== */}
        <Grid item xs={4}>
          <Paper sx={{ p: 2 }}>
            <List
              dense
              sx={{ maxHeight: 'calc(100vh - 100px)', overflow: 'auto' }}
            >
              {/* Состояние: загрузка */}
              {loadingList && (
                <ListItem>
                  <CircularProgress size={18} sx={{ mr: 1 }} />
                  <ListItemText primary="Загрузка..." />
                </ListItem>
              )}

              {/* Состояние: ошибка */}
              {!loadingList && !!errList && (
                <ListItem>
                  <ListItemText primary={errList} />
                </ListItem>
              )}

              {/* Состояние: пусто */}
              {!loadingList && !errList && list.length === 0 && (
                <ListItem>
                  <ListItemText primary="Поставщики не найдены" />
                </ListItem>
              )}

              {/* Список поставщиков */}
              {list.map((r) => (
                <ListItem
                  key={r.id}
                  disablePadding
                  selected={r.id === selectedId}
                >
                  <ListItemButton onClick={() => setSelectedId(r.id)}>
                    <ListItemText
                      primary={
                        <Typography component="div" sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ flex: 1 }}>{r.name}</Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography
                              component="span"
                              sx={{ fontWeight: 700, color: 'text.primary' }}
                            >
                              {renderStatus(r.status)}
                            </Typography>
                          </Box>
                        </Typography>
                      }
                      secondary={
                        <Typography
                          component="div"
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            mt: 0.3,
                          }}
                        >
                          {r.activity && (
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 500 }}
                            >
                              {r.activity}
                            </Typography>
                          )}
                          {r.categories_short && (
                            <Typography
                              variant="body2"
                              sx={{ color: 'text.secondary' }}
                            >
                              Категории: {r.categories_short}
                            </Typography>
                          )}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* ====== ПРАВАЯ КОЛОНКА: ФИЛЬТРЫ + ДЕТАЛИ ====== */}
        <Grid item xs={8}>
          <Grid container direction="column" spacing={2}>
            {/* ВЕРХНЯЯ ЧАСТЬ: ФИЛЬТРЫ */}
            <Grid item>
              <Paper sx={{ p: 2 }}>
                {/* Кнопка "Новый", Поиск, Статус */}
                <Stack
                  direction="row"
                  flexWrap="wrap"
                  spacing={1}
                  sx={{ mb: 2, rowGap: 1 }}
                >
                  <Button
                    size="small"
                    variant="contained"
                    href={fixPath('/reference/suppliers/new')}
                  >
                    Новый поставщик
                  </Button>

                  <TextField
                    size="small"
                    label="Поиск"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id="flt-status">Статус</InputLabel>
                    <Select
                      labelId="flt-status"
                      value={statusFilter}
                      label="Статус"
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                      <MenuItem value="all">Все</MenuItem>
                      <MenuItem value="preferred">Предпочитаемый</MenuItem>
                      <MenuItem value="regular">Обычный</MenuItem>
                      <MenuItem value="blocked">Блокирован</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                {/* Фильтр по категориям */}
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Фильтр по категориям:
                </Typography>
                <CategoryTreeSelect
                  multiple={true}
                  value={categoryFilter}
                  onChange={(val) => {
                    setCategoryFilter(Array.isArray(val) ? val : []);
                  }}
                  label="Выберите категории"
                />
              </Paper>
            </Grid>

            {/* НИЖНЯЯ ЧАСТЬ: ДЕТАЛЬНАЯ КАРТОЧКА */}
            <Grid item>
              <Paper sx={{ p: 2 }}>
                {/* Сообщение если поставщик не выбран */}
                {!selectedId && (
                  <Typography color="text.secondary">
                    Выберите поставщика слева
                  </Typography>
                )}

                {/* Детали выбранного поставщика */}
                {!!selectedId && (
                  <>
                    {/* Заголовок + кнопка редактирования */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6">
                        {detail?.name || `Поставщик #${selectedId}`}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      {loadingDetail && (
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        href={fixPath(`/reference/suppliers/${selectedId}/edit`)}
                      >
                        Редактировать
                      </Button>
                    </Box>

                    {/* Основная информация о поставщике */}
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Левая колонка */}
                      <Box sx={{ flex: 1, minWidth: 260 }}>
                        {detail?.inn && (
                          <Typography>
                            <b>ИНН:</b> {detail.inn}
                          </Typography>
                        )}
                        {detail?.activity && (
                          <Typography>
                            <b>Деятельность:</b> {detail.activity}
                          </Typography>
                        )}
                        {detail?.address && (
                          <Typography>
                            <b>Адрес:</b> {detail.address}
                          </Typography>
                        )}
                        <Typography>
                          <b>Статус:</b> {renderStatus(detail?.status)}
                        </Typography>
                        <Typography>
                          <b>Рейтинг:</b>{' '}
                          {detail?.rating != null ? detail.rating : '—'}
                        </Typography>
                        <Typography>
                          <b>Активен:</b>{' '}
                          {detail?.is_active ? 'Да' : 'Нет'}
                        </Typography>

                        {/* Категории поставщика */}
                        <Typography sx={{ mt: 1 }}>
                          <b>Категории:</b>{' '}
                          {detail?.categories_short || 'Не указаны'}
                        </Typography>
                      </Box>

                      {/* Правая колонка: условия и метаданные */}
                      <Box sx={{ minWidth: 260, ml: 'auto', textAlign: 'right' }}>
                        {detail?.terms && (
                          <>
                            {detail.terms.payment_terms && (
                              <Typography>
                                <b>Оплата:</b> {detail.terms.payment_terms}
                              </Typography>
                            )}
                            {detail.terms.min_order_amount && (
                              <Typography>
                                <b>Мин. заказ:</b>{' '}
                                {detail.terms.min_order_amount}
                              </Typography>
                            )}
                            {detail.terms.lead_time_days != null && (
                              <Typography>
                                <b>Срок поставки:</b>{' '}
                                {detail.terms.lead_time_days} дн.
                              </Typography>
                            )}
                            {detail.terms.delivery_regions && (
                              <Typography>
                                <b>Регионы:</b>{' '}
                                {detail.terms.delivery_regions}
                              </Typography>
                            )}
                          </>
                        )}
                        <Typography sx={{ mt: 1 }}>
                          <b>Создан:</b> {fmtDate(detail?.created_at)}
                        </Typography>
                        <Typography>
                          <b>Изменён:</b> {fmtDate(detail?.updated_at)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* СЕКЦИЯ: Заметки */}
                    {detail?.notes && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Заметки
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                          {detail.notes}
                        </Typography>
                      </>
                    )}

                    {/* СЕКЦИЯ: Контакты */}
                    {detail?.contacts && detail.contacts.length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Контакты
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>ФИО</TableCell>
                                <TableCell>Должность</TableCell>
                                <TableCell>Телефон</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Комментарий</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {detail.contacts.map((c) => (
                                <TableRow key={c.id}>
                                  <TableCell>{c.person_name}</TableCell>
                                  <TableCell>{c.position}</TableCell>
                                  <TableCell>{c.phone}</TableCell>
                                  <TableCell>{c.email}</TableCell>
                                  <TableCell>{c.comment}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    )}

                    {/* СЕКЦИЯ: Прайс-листы */}
                    {detail?.pricelists && detail.pricelists.length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Прайс-листы
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Название</TableCell>
                                <TableCell>Актуально с</TableCell>
                                <TableCell>Валюта</TableCell>
                                <TableCell>Комментарий</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {detail.pricelists.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell>{p.title}</TableCell>
                                  <TableCell>{fmtDate(p.valid_from)}</TableCell>
                                  <TableCell>{p.currency}</TableCell>
                                  <TableCell>{p.comment}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    )}
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
