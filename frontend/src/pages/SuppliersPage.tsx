/**
 * Страница "Поставщики".
 *
 * Левая колонка:
 *  - фильтры (поиск, статус, регион),
 *  - список поставщиков (краткая информация + категории).
 *
 * Правая колонка:
 *  - детальная карточка выбранного поставщика:
 *    основные поля, категории, условия, контакты, прайсы.
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
import { http, fixPath } from '../api/_http';

// --- Типы, совпадающие с DRF-сериализаторами ---

// Строка в списке поставщиков (левая колонка)
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
  // краткая строка с категориями, заполняется на бэкенде (SupplierListSerializer)
  categories_short?: string;
};

// Контакты в детальной карточке
type SupplierContact = {
  id: number;
  person_name: string;
  position?: string;
  phone?: string;
  email?: string;
  comment?: string;
};

// Условия поставки/оплаты
type SupplierTerms = {
  payment_terms?: string;
  min_order_amount?: string;
  lead_time_days?: number;
  delivery_regions?: string;
  delivery_notes?: string;
};

// Сводка по прайс-листу (если будет использоваться)
type SupplierPriceListSummary = {
  id: number;
  title: string;
  valid_from?: string;
  currency?: string;
  comment?: string;
};

// Детальная карточка поставщика (правая колонка)
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
  // на бэке categories — список id; categories_short — готовая строка
  categories?: number[];
  categories_short?: string;
  contacts?: SupplierContact[];
  terms?: SupplierTerms;
  pricelists?: SupplierPriceListSummary[];
  created_at?: string;
  updated_at?: string;
};

// Форматирование даты для отображения
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

// Человекочитаемый статус допуска
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

export default function SuppliersPage() {
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

  // список / фильтры
  const [list, setList] = React.useState<SupplierRow[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [errList, setErrList] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string | 'all'>('all');
  const [regionFilter, setRegionFilter] = React.useState('');

  // выбор / деталка
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<SupplierDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Загрузка списка поставщиков (левая колонка)
  const loadList = React.useCallback(async () => {
    setLoadingList(true);
    setErrList(null);
    try {
      const params: string[] = ['page_size=200', 'ordering=name'];
      if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
      if (statusFilter !== 'all')
        params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (regionFilter.trim())
        params.push(`region=${encodeURIComponent(regionFilter.trim())}`);

      const url = fixPath(`/api/suppliers/?${params.join('&')}`);
      const { data } = await http.get(url);
      const rows: SupplierRow[] = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];
      setList(rows);

      // Автовыбор первой строки
      if (!selectedId && rows.length) {
        setSelectedId(rows[0].id);
      } else if (selectedId && !rows.find((r) => r.id === selectedId)) {
        setSelectedId(rows.length ? rows[0].id : null);
      }
    } catch (e: any) {
      setErrList(e?.message || 'Ошибка загрузки');
    } finally {
      setLoadingList(false);
    }
  }, [search, statusFilter, regionFilter, selectedId]);

  // Загрузка детальной карточки (правая колонка)
  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    let alive = true;
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
    return () => {
      alive = false;
    };
  }, [selectedId]);

  // Инициализация списка при первом рендере и смене фильтров
  React.useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <Box sx={pageSx}>
      <Grid container spacing={2}>
        {/* LEFT: список поставщиков + фильтры */}
        <Grid item xs={4}>
          <Paper sx={{ p: 2 }}>
            {/* Фильтры + кнопка создания */}
            <Stack
              direction="row"
              flexWrap="wrap"
              spacing={1}
              sx={{ mb: 1, rowGap: 1 }}
            >
              <Button
                size="small"
                variant="contained"
                href={fixPath('/suppliers/new')}
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

              <TextField
                size="small"
                label="Регион"
                placeholder="Москва"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
              />
            </Stack>

            <Divider sx={{ my: 1 }} />

            {/* Список поставщиков */}
            <List
              dense
              sx={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}
            >
              {loadingList && (
                <ListItem>
                  <CircularProgress size={18} sx={{ mr: 1 }} />
                  <ListItemText primary="Загрузка..." />
                </ListItem>
              )}
              {!loadingList && !!errList && (
                <ListItem>
                  <ListItemText primary={errList} />
                </ListItem>
              )}
              {!loadingList && !errList && list.length === 0 && (
                <ListItem>
                  <ListItemText primary="Поставщики не найдены" />
                </ListItem>
              )}

              {list.map((r) => (
                <ListItem
                  key={r.id}
                  disablePadding
                  selected={r.id === selectedId}
                >
                  <ListItemButton onClick={() => setSelectedId(r.id)}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ flex: 1 }}>{r.name}</Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography
                              component="span"
                              sx={{ fontWeight: 700, color: 'text.primary' }}
                            >
                              {renderStatus(r.status)}
                            </Typography>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box
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
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* RIGHT: детальная карточка */}
        <Grid item xs={8}>
          <Paper sx={{ p: 2 }}>
            {!selectedId && (
              <Typography color="text.secondary">
                Выберите поставщика слева
              </Typography>
            )}

            {!!selectedId && (
              <>
                {/* Заголовок карточки + кнопка "Редактировать" */}
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
                    href={fixPath(`/suppliers/${selectedId}/edit`)}
                  >
                    Редактировать
                  </Button>
                </Box>

                {/* Основная информация */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
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

                    {/* Категории поставщика (подробно) */}
                    <Typography sx={{ mt: 1 }}>
                      <b>Категории:</b>{' '}
                      {detail?.categories_short || 'Не указаны'}
                    </Typography>
                  </Box>

                  {/* Условия и метаданные */}
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

                {/* Заметки */}
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

                {/* Контакты */}
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

                {/* Прайс-листы (опционально) */}
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
    </Box>
  );
}
