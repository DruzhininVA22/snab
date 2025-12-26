/**
 * Справочник поставщиков.
 *
 * Страница для просмотра/поиска поставщиков.
 * Дополнительно может быть точкой входа для создания/редактирования карточек поставщика.
 */
import * as React from 'react';
import {
  Box, Grid, Paper, List, ListItem, ListItemButton, ListItemText,
  Typography, Divider, FormControl, InputLabel, Select, MenuItem, Button,
  CircularProgress, TextField, Stack, Chip, Table, TableBody, TableRow, TableCell,
  TableHead
} from '@mui/material';
import { http, fixPath } from '../api/_http';

type SupplierRow = {
  id: number;
  name: string;
  activity?: string;
  status?: string;
  status_label?: string;
  rating?: number;
  main_region?: string;
  payment_terms?: string;
};

type SupplierContact = {
  id: number;
  person_name: string;
  position?: string;
  phone?: string;
  email?: string;
  comment?: string;
};

type SupplierTerms = {
  payment_terms?: string;
  min_order_amount?: string;
  lead_time_days?: number;
  delivery_regions?: string;
  delivery_notes?: string;
};

type SupplierPriceListSummary = {
  id: number;
  title: string;
  valid_from?: string;
  currency?: string;
  comment?: string;
};

type SupplierCategoryMini = {
  id: number;
  code?: string;
  name: string;
  path?: string;
  is_leaf?: boolean;
};

type SupplierDetail = {
  id: number;
  name: string;
  inn?: string;
  activity?: string;
  address?: string;
  is_active?: boolean;
  rating?: number;
  status?: string;
  status_label?: string;
  notes?: string;
  categories?: SupplierCategoryMini[];
  contacts?: SupplierContact[];
  terms?: SupplierTerms;
  pricelists?: SupplierPriceListSummary[];
  created_at?: string;
  updated_at?: string;
};

function renderStars(val: any) {
  const n = Math.max(0, Math.min(5, Number(val) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function fmtDate(d?: string) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
}

export default function SuppliersPage() {
  const pageSx = {
    px: 1, mx: -1,
    fontSize: '0.875rem',
    lineHeight: 1.35,
    '& .MuiTypography-root': { fontSize: '0.875rem' },
    '& .MuiButton-root, & .MuiInputBase-root, & .MuiSelect-select, & .MuiMenuItem-root': { fontSize: '0.875rem' },
    '& .MuiTableCell-root': { fontSize: '0.8125rem' },
    '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
  } as const;

  // list / filters
  const [list, setList] = React.useState<SupplierRow[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [errList, setErrList] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string | 'all'>('all');
  const [regionFilter, setRegionFilter] = React.useState('');

  // selection / detail
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<SupplierDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // fetch list
  const loadList = React.useCallback(async () => {
    setLoadingList(true); setErrList(null);
    try {
      const params: string[] = ['page_size=200', 'ordering=name'];
      if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
      if (statusFilter !== 'all') params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (regionFilter.trim()) params.push(`region=${encodeURIComponent(regionFilter.trim())}`);

      const url = fixPath(`/api/suppliers/?${params.join('&')}`);
      const { data } = await http.get(url);
      const rows: SupplierRow[] = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data) ? data : [];
      setList(rows);

      if (!selectedId && rows.length) {
        setSelectedId(rows[0].id);
      } else if (selectedId && !rows.find(r => r.id === selectedId)) {
        setSelectedId(rows.length ? rows[0].id : null);
      }
    } catch (e: any) {
      setErrList(e?.message || 'Ошибка загрузки');
    } finally {
      setLoadingList(false);
    }
  }, [search, statusFilter, regionFilter, selectedId]);

  // fetch detail
  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    let alive = true;
    http.get(fixPath(`/api/suppliers/${selectedId}/`))
      .then(({ data }) => { if (alive) setDetail(data); })
      .catch(() => { if (alive) setDetail(null); })
      .finally(() => { if (alive) setLoadingDetail(false); });
    return () => { alive = false; };
  }, [selectedId]);

  // init list
  React.useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <Box sx={pageSx}>
      <Grid container spacing={2}>
        {/* LEFT: список поставщиков + фильтры */}
        <Grid item xs={4}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 1, rowGap: 1 }}>
              <Button size="small" variant="contained" href={fixPath('/suppliers/new')}>
                Новый поставщик
              </Button>

              <TextField
                size="small"
                label="Поиск"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="flt-status">Статус</InputLabel>
                <Select
                  labelId="flt-status"
                  value={statusFilter}
                  label="Статус"
                  onChange={e => setStatusFilter(e.target.value as any)}
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
                onChange={e => setRegionFilter(e.target.value)}
              />

              <Button size="small" onClick={loadList}>Обновить</Button>
            </Stack>

            <Divider sx={{ mb: 1 }} />

            <List dense sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
              {loadingList && (
                <ListItem><ListItemText primary="Загрузка..." /></ListItem>
              )}
              {!loadingList && !!errList && (
                <ListItem><ListItemText primary="Ошибка" secondary={errList} /></ListItem>
              )}
              {!loadingList && !errList && list.length === 0 && (
                <ListItem><ListItemText primary="Поставщики не найдены" /></ListItem>
              )}

              {list.map(s => (
                <ListItem
                  key={s.id}
                  disablePadding
                  selected={s.id === selectedId}
                >
                  <ListItemButton onClick={() => setSelectedId(s.id)}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ flex: 1, fontWeight: 600 }}>{s.name}</Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                              {s.status_label || s.status || '—'}
                            </Typography>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <>
                          {/* деятельность | регион */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.3 }}>
                            <Typography component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {s.activity || '— деятельность'}
                            </Typography>
                            <Box sx={{ flex: 1, textAlign: 'center', color: 'text.primary' }}>|</Box>
                            <Typography component="span" sx={{ fontWeight: 700, color: 'success.main', textAlign: 'right' }}>
                              {s.main_region || '— регион'}
                            </Typography>
                          </Box>

                          {/* условия оплаты + рейтинг */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.3 }}>
                            <Typography
                              component="span"
                              sx={{ fontWeight: 500, color: 'text.secondary', flex: 1 }}
                            >
                              {s.payment_terms || '— условия оплаты'}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{ fontWeight: 500, color: 'text.secondary', textAlign: 'right', whiteSpace: 'nowrap' }}
                            >
                              {renderStars(s.rating)}
                            </Typography>
                          </Box>
                        </>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* RIGHT: карточка поставщика */}
        <Grid item xs={8}>
          <Paper sx={{ p: 2 }}>
            {!selectedId && (
              <Typography color="text.secondary">Выберите поставщика слева</Typography>
            )}

            {!!selectedId && (
              <>
                {/* заголовок */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">
                    Поставщик {detail?.name || `#${selectedId}`}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {loadingDetail && <CircularProgress size={16} sx={{ mr: 1 }} />}
                  <Button
                    size="small"
                    variant="outlined"
                    href={fixPath(`/suppliers/${selectedId}/edit`)}
                  >
                    Редактировать
                  </Button>
                </Box>

                {/* основной блок */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 260 }}>
                    {detail?.notes && (
                      <>
                        <Typography variant="subtitle2">Описание / заметки</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{detail.notes}</Typography>
                      </>
                    )}

                    {/* Контакты */}
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Контакты</Typography>
                    {detail?.contacts && detail.contacts.length > 0 ? (
                      <Table size="small" sx={{ mb: 2 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Контакт</TableCell>
                            <TableCell>Телефон</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Комментарий</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detail.contacts.map(c => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <Typography sx={{ fontWeight: 600 }}>{c.person_name}</Typography>
                                <Typography variant="body2" color="text.secondary">{c.position || ''}</Typography>
                              </TableCell>
                              <TableCell>{c.phone || '—'}</TableCell>
                              <TableCell>{c.email || '—'}</TableCell>
                              <TableCell>{c.comment || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography color="text.secondary" sx={{ mb: 2 }}>Контактов нет</Typography>
                    )}

                    {/* Прайс-листы */}
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Прайс-листы</Typography>
                    {detail?.pricelists && detail.pricelists.length > 0 ? (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Название</TableCell>
                            <TableCell>Дата</TableCell>
                            <TableCell>Валюта</TableCell>
                            <TableCell>Комментарий</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detail.pricelists.map(p => (
                            <TableRow key={p.id}>
                              <TableCell>{p.title}</TableCell>
                              <TableCell>{fmtDate(p.valid_from)}</TableCell>
                              <TableCell>{p.currency || '—'}</TableCell>
                              <TableCell>{p.comment || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography color="text.secondary">Прайсов нет</Typography>
                    )}
                  </Box>

                  {/* Атрибуты справа */}
                  <Box sx={{ minWidth: 260, ml: 'auto' }}>
                    <Typography><b>ИНН:</b> {detail?.inn || '—'}</Typography>
                    <Typography><b>Адрес:</b> {detail?.address || '—'}</Typography>
                    <Typography><b>Деятельность:</b> {detail?.activity || '—'}</Typography>
                    <Typography><b>Активен:</b> {detail?.is_active ? 'Да' : 'Нет'}</Typography>
                    <Typography><b>Статус:</b> {detail?.status_label || detail?.status || '—'}</Typography>
                    <Typography><b>Рейтинг:</b> {renderStars(detail?.rating)}</Typography>

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2">Категории</Typography>
                      {detail?.categories && detail.categories.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {detail.categories.map(cat => (
                            <Chip
                              key={cat.id}
                              label={(cat.code ? cat.code + ' ' : '') + (cat.name || '')}
                              size="small"
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2">Условия поставки</Typography>
                      <Typography><b>Оплата:</b> {detail?.terms?.payment_terms || '—'}</Typography>
                      <Typography><b>Мин. заказ:</b> {detail?.terms?.min_order_amount || '—'}</Typography>
                      <Typography><b>Срок (дн.):</b> {detail?.terms?.lead_time_days ?? '—'}</Typography>
                      <Typography><b>Регион:</b> {detail?.terms?.delivery_regions || '—'}</Typography>
                      <Typography><b>Доставка:</b> {detail?.terms?.delivery_notes || '—'}</Typography>
                    </Box>
                  </Box>
                </Box>

              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
