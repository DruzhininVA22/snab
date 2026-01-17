/**
 * Список заявок на закупку (PR) + быстрый просмотр строк заявки.
 *
 * Это одна из ключевых страниц SNAB:
 * - отображает перечень заявок,
 * - позволяет фильтровать/переходить к созданию/редактированию,
 * - подтягивает справочники (ед. изм, номенклатура, проекты/этапы) для корректного отображения линий заявки.
 */
import * as React from 'react';
import {
  Box, Grid, Paper, List, ListItem, ListItemButton, ListItemText,
  Typography, Divider, FormControl, InputLabel, Select, MenuItem, Button,
  CircularProgress
} from '@mui/material';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { http, fixPath } from '../api/_http';

type PR = {
  id: number;
  created_at?: string;
  status?: string;
  comment?: string;
  project_id?: number | null;
  project_name?: string | null;
  stage_id?: number | null;
  stage_name?: string | null;
  deadline_at?: string | null;
  lines?: any[];
};

type RefProject = { id: number; name: string };
type RefStage = { id: number; name: string; project_id: number };

const LINE_STATUS_LABELS: Record<string, string> = {
  pending: 'Поставщик не утвержден',
  processing: 'Обработка',
  awarded: 'Утвержден поставщик',
  delivered: 'Поставлено',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: 'Формируется',
  open: 'Открыта',
  closed: 'Закрыта',
  cancelled: 'Отменена',
  canceled: 'Отменена',
};

function fmt(dt?: string) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return dt || ''; }
}
function fmtQty(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? '');
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}
function extractRows(data: any): PR[] {
  if (Array.isArray(data)) return data as PR[];
  if (Array.isArray(data?.results)) return data.results as PR[];
  if (Array.isArray(data?.data?.results)) return data.data.results as PR[];
  return [];
}

export default function PurchaseRequestsPage() {
  const [list, setList] = React.useState<PR[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<PR | null>(null);
  const [selectedLoading, setSelectedLoading] = React.useState(false);

  const [projects, setProjects] = React.useState<RefProject[]>([]);
  const [stages, setStages] = React.useState<RefStage[]>([]);

  const [fltProject, setFltProject] = React.useState<number | 'all'>('all');
  const [fltStage, setFltStage] = React.useState<number | 'all'>('all');
  const [fltStatus, setFltStatus] = React.useState<string | 'all'>('all');

  const fetchProjectsList = React.useCallback(async () => {
    const tryUrls = [
      fixPath('/api/projects/projects/?page_size=1000'),
      fixPath('/api/projects/?page_size=1000'),
      fixPath('/api/projects/project/?page_size=1000'),
      fixPath('/api/projects/list/?page_size=1000'),
    ];
    for (const url of tryUrls) {
      try {
        const { data } = await http.get(url);
        const raw = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        if (raw.length) {
          setProjects(raw.map((p: any) => ({
            id: p.id,
            name: p.name || p.title || p.code || `#${p.id}`,
          })));
          return;
        }
      } catch { }
    }
    try {
      const { data } = await http.get(fixPath('/api/procurement/purchase-requests/refs/'));
      if (Array.isArray(data?.projects) && data.projects.length) {
        setProjects(data.projects);
      }
    } catch { }
  }, []);

  const fetchProjectStages = React.useCallback(async (projectId: number) => {
    const tryUrls = [
      fixPath(`/api/projects/project-stages/?project=${projectId}&page_size=1000`),
      fixPath(`/api/projects/stages/?project=${projectId}&page_size=1000`),
      fixPath(`/api/projects/projectstages/?project=${projectId}&page_size=1000`),
      fixPath(`/api/projects/stage/?project=${projectId}&page_size=1000`),
    ];
    for (const url of tryUrls) {
      try {
        const { data } = await http.get(url);
        const raw = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        if (raw.length) {
          setStages(raw.map((s: any) => ({
            id: s.id,
            name: s.name || s.title || s.code || `#${s.id}`,
            project_id: s.project || s.project_id || projectId,
          })));
          return;
        }
      } catch { }
    }
    try {
      const base = fixPath('/api/procurement/purchase-requests/refs/');
      const { data } = await http.get(`${base}?project=${projectId}`);
      if (Array.isArray(data?.stages)) setStages(data.stages);
    } catch { }
  }, []);

  const loadList = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const params: string[] = ['ordering=-id', 'page_size=200'];
      if (fltProject !== 'all') params.push(`project=${fltProject}`);
      if (fltStage !== 'all') params.push(`stage=${fltStage}`);
      if (fltStatus !== 'all') params.push(`status=${encodeURIComponent(fltStatus)}`);
      const url = fixPath(`/api/procurement/purchase-requests/?${params.join('&')}`);
      const res = await http.get(url);
      const rows = extractRows(res.data);
      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
      if (selectedId && !rows.some(r => r.id === selectedId)) {
        setSelectedId(rows.length ? rows[0].id : null);
      }
    } catch (e: any) {
      setErr(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [fltProject, fltStage, fltStatus, selectedId]);

  React.useEffect(() => { fetchProjectsList(); }, [fetchProjectsList]);
  React.useEffect(() => { loadList(); }, [loadList]);

  React.useEffect(() => {
    if (fltProject === 'all') { setStages([]); setFltStage('all'); return; }
    setFltStage('all');
    fetchProjectStages(Number(fltProject));
  }, [fltProject, fetchProjectStages]);

  React.useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    setSelectedLoading(true);
    let alive = true;
    http.get(fixPath(`/api/procurement/purchase-requests/${selectedId}/`))
      .then(({ data }) => { if (alive) setSelected(data as PR); })
      .catch(() => { if (alive) setSelected(null); })
      .finally(() => { if (alive) setSelectedLoading(false); });
    return () => { alive = false; };
  }, [selectedId]);

  const deleteRequest = async (id: number) => {
    if (!window.confirm('Удалить заявку?')) return;
    try {
      await http.delete(fixPath(`/api/procurement/purchase-requests/${id}/`));
      alert('Удалено');
      loadList();
    } catch (e: any) {
      alert('Ошибка: ' + e?.message);
    }
  };

  return (
    // ↓ уменьшаем горизонтальные поля страницы ~вдвое
    <Box
      sx={{
        px: 1,
        mx: -1,                 // уже сужали общие поля
        fontSize: '0.875rem',   // -1 шаг от базового (≈14px)
        lineHeight: 1.35,

        // Унифицируем размер у типовых элементов, чтобы визуально было ровно
        '& .MuiTypography-root': { fontSize: '0.875rem' },
        '& .MuiButton-root, & .MuiInputBase-root, & .MuiSelect-select, & .MuiMenuItem-root':
          { fontSize: '0.875rem' },
        '& .MuiTableCell-root': { fontSize: '0.8125rem' }, // таблица чуть компактнее

        // Заголовок «Заявка #…» оставим читаемым:
        '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
      }}
    >
      <Grid container spacing={2}>
        {/* ЛЕВАЯ КОЛОНКА — как раньше */}
        <Grid item xs={4}>
          <Paper sx={{ p: 2 }}>
            <Box p={0} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button size="small" variant="contained" href={fixPath('/pr/new')}>
                Новая заявка
              </Button>

              <FormControl size="small" sx={{ minWidth: 160, flex: '1 1 160px' }}>
                <InputLabel id="flt-project">Проект</InputLabel>
                <Select labelId="flt-project" value={fltProject} label="Проект"
                  onChange={e => setFltProject(e.target.value as any)}>
                  <MenuItem value="all">Все</MenuItem>
                  {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 180, flex: '1 1 180px' }} disabled={fltProject === 'all'}>
                <InputLabel id="flt-stage">Этап</InputLabel>
                <Select labelId="flt-stage" value={fltStage} label="Этап"
                  onChange={e => setFltStage(e.target.value as any)}>
                  <MenuItem value="all">Все</MenuItem>
                  {stages.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 160, flex: '1 1 160px' }}>
                <InputLabel id="flt-status">Статус</InputLabel>
                <Select
                  labelId="flt-status"
                  value={fltStatus}
                  label="Статус"
                  onChange={e => setFltStatus(e.target.value as any)}
                >
                  <MenuItem value="all">Все</MenuItem>
                  {['draft', 'open', 'closed', 'cancelled'].map(code => (
                    <MenuItem key={code} value={code}>
                      {REQUEST_STATUS_LABELS[code] || code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button size="small" onClick={loadList}>Обновить</Button>
            </Box>
            <Divider sx={{ my: 1 }} />

            <List dense sx={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
              {loading && <ListItem><ListItemText primary="Загрузка..." /></ListItem>}
              {!loading && !!err && <ListItem><ListItemText primary="Ошибка: " secondary={err} /></ListItem>}
              {!loading && !err && list.length === 0 && <ListItem><ListItemText primary="Нет заявок" /></ListItem>}
              {list.map((r) => {
                const desc = r.comment?.trim();
                const statusLabel = REQUEST_STATUS_LABELS[r.status] ?? r.status;

                return (
                  <ListItem key={r.id} disablePadding selected={r.id === selectedId}>
                    <ListItemButton onClick={() => setSelectedId(r.id)}>
                      <ListItemText
                        primary={
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box component="span" sx={{ flex: 1 }}>
                              {fmt(r.created_at)} ID {r.id}
                            </Box>
                            <Box component="span" sx={{ textAlign: 'right' }}>
                              <Typography
                                component="span"
                                sx={{ fontWeight: 700, color: 'text.primary' }}
                              >
                                {statusLabel}
                              </Typography>
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box component="span">
                            <Typography
                              component="span"
                              variant="body2"
                              sx={{ fontWeight: 700, color: 'primary.main' }}
                            >
                              {r.project_name || `Проект #${r.project_id || '—'}`}
                            </Typography>
                            {' → '}
                            <Typography
                              component="span"
                              variant="body2"
                              sx={{ fontWeight: 700, color: 'success.main' }}
                            >
                              {r.stage_name || `Этап #${r.stage_id || '—'}`}
                            </Typography>
                            {desc && (
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{ display: 'block', mt: 0.5, fontWeight: 500 }}
                              >
                                {desc}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Grid>

        {/* ПРАВАЯ КОЛОНКА */}
        <Grid item xs={8}>
          <Paper sx={{ p: 2 }}>
            {!selectedId && <Typography color="text.secondary">Выберите заявку слева</Typography>}
            {!!selectedId && (
              <>
                {/* Заголовок: Заявка #… слева, кнопка справа НА ОДНОМ УРОВНЕ */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Заявка #{selectedId}</Typography>
                  <Box sx={{ flex: 1 }} />
                  {selectedLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
                  <Button size="small" variant="outlined" href={fixPath(`/pr/${selectedId}/edit`)}>
                    Редактировать
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    disabled={!selectedId}
                    onClick={() => deleteRequest(selectedId)}
                  >
                    Удалить
                  </Button>
                </Box>


                {/* Описание слева, атрибуты справа (вправо, столбцом) */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 1, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 260 }}>
                    {selected?.comment && (
                      <>
                        <Typography variant="subtitle2">Описание</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{selected.comment}</Typography>
                      </>
                    )}
                  </Box>
                  <Box sx={{ minWidth: 260, ml: 'auto', textAlign: 'right' }}>
                    <Typography><b>Проект:</b> {selected?.project_name || '—'}</Typography>
                    <Typography><b>Этап:</b> {selected?.stage_name || '—'}</Typography>
                    <Typography><b>Статус:</b> {REQUEST_STATUS_LABELS[selected?.status ?? ''] || selected?.status || '—'}</Typography>
                    <Typography><b>Дедлайн:</b> {fmt(selected?.deadline_at || undefined) || '—'}</Typography>
                    <Typography><b>Дата создания:</b> {fmt(selected?.created_at)}</Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Строки заявки</Typography>

                {/* Таблица — c обычными (не урезанными) горизонтальными отступами */}
                <TableContainer component={Box}>
                  <Table size="small" aria-label="purchase request lines">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 28 }} align="right">№</TableCell>
                        <TableCell>Наименование номенклатуры</TableCell>
                        <TableCell sx={{ width: 48 }}>Ед.</TableCell>
                        <TableCell sx={{ width: 60 }} align="right">Кол-во</TableCell>
                        <TableCell sx={{ width: 100 }}>Статус</TableCell>
                        <TableCell>Комментарий</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.isArray(selected?.lines) && selected!.lines!.length > 0 ? (
                        selected!.lines!.map((ln: any, idx: number) => (
                          <TableRow key={ln.id} hover={false}>
                            <TableCell align="right">{idx + 1}</TableCell>
                            <TableCell>{ln.item_name || '—'}</TableCell>
                            <TableCell>{ln.unit_name || '—'}</TableCell>
                            <TableCell align="right">{fmtQty(ln.qty)}</TableCell>
                            <TableCell>{LINE_STATUS_LABELS[ln.status] || ln.status || '—'}</TableCell>
                            <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{(ln.comment || '').trim()}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography color="text.secondary">Нет строк</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box >
  );
}
