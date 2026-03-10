/**
 * Редактирование заявки на закупку (Purchase Request).
 * 
 * Позволяет изменить проект, этап, комментарий, дедлайн и строки заявки.
 * Заблокировано для заявок в статусе closed/done/approved/cancelled.
 */
import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  LinearProgress,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Chip,
  ListItemText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AddIcon from '@mui/icons-material/Add';
import { useParams, useNavigate } from 'react-router-dom';
import { http, fixPath } from '../api/_http';
import ProjectSelect from '../components/ProjectSelect';
import ProjectStageSelect from '../components/ProjectStageSelect';
import CatalogPickDialog, { CatalogPickResult } from '../components/CatalogPickDialog';

type UnitRef = {
  id: number;
  name: string;
  code?: string;
};

type SupplierRef = {
  id: number;
  name: string;
};

type QuoteSummary = {
  id: number;
  supplier_name?: string;
  status?: string;
  total_price?: any;
  currency?: string;
  received_at?: string | null;
  purchase_request_id?: number;
};

const quoteStatusLabels: Record<string, string> = {
  received: 'Получено',
  reviewed: 'Рассмотрено',
  selected: 'Утверждено',
  rejected: 'Отклонено',
};

function fmtMoney(amount: any, currency?: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const cur = currency || 'RUB';
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: cur }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

type Line = {
  id?: number;
  item: number | null;
  itemName?: string;
  categoryName?: string;
  unit?: number | null;
  unitName?: string;
  qty: number;
  note?: string;
};

/** Извлечь числовой ID из разных форматов */
function pickId(src: any): number | null {
  if (src === null) return null;
  if (typeof src === 'number') return src;
  if (typeof src === 'string') {
    const n = Number(src);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof src === 'object') {
    if ('id' in src && typeof (src as any).id !== 'undefined') {
      const n = Number((src as any).id);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}



function dateOnly(v?: string): string {
  if (!v) return '';
  const s = String(v);
  return s.includes('T') ? s.split('T')[0] : s;
}

function statusRu(st?: string): string {
  const s = (st || '').toLowerCase();
  const map: Record<string, string> = {
    draft: 'Черновик',
    open: 'Открыта',
    in_progress: 'В работе',
    sent: 'Отправлена',
    received: 'Получено',
    reviewed: 'На рассмотрении',
    selected: 'Утверждена',
    approved: 'Утверждена',
    rejected: 'Отклонена',
    closed: 'Закрыта',
    cancelled: 'Отменена',
    done: 'Завершена',
  };
  return map[s] || (st || '—');
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

async function tryGetJson(urls: string[]): Promise<any | null> {
  for (const u of urls) {
    try {
      const { data } = await http.get(fixPath(u));
      return data;
    } catch {
      // try next
    }
  }
  return null;
}

export default function PurchaseRequestEditPage() {
  const pageSx = {
    px: 1,
    mx: -1,
    fontSize: '0.875rem',
    lineHeight: 1.35,
    '& .MuiTypography-root': { fontSize: '0.875rem' },
    '& .MuiButton-root, .MuiInputBase-root, .MuiSelect-select, .MuiMenuItem-root': {
      fontSize: '0.875rem',
    },
    '& .MuiTableCell-root': { fontSize: '0.8125rem' },
    '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
  } as const;

  const { id } = useParams();
  const nav = useNavigate();

  // Состояние заявки
  const [loading, setLoading] = React.useState(false);
  const [comment, setComment] = React.useState('');
  const [deadline, setDeadline] = React.useState<string>('');
  const [projectId, setProjectId] = React.useState<number | null>(null);
  const [stageId, setStageId] = React.useState<number | null>(null);
  const [projectTitle, setProjectTitle] = React.useState<string>('');
  const [stageTitle, setStageTitle] = React.useState<string>('');
  const [createdAt, setCreatedAt] = React.useState<string>('');
  const [status, setStatus] = React.useState<string>('');
  const [lines, setLines] = React.useState<Line[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Справочники
  const [units, setUnits] = React.useState<UnitRef[]>([]);
  const [pickIdx, setPickIdx] = React.useState<number | null>(null);

  // КП (Запрос поставщикам)
  const [rfqOpen, setRfqOpen] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<SupplierRef[]>([]);
  const [supplierIds, setSupplierIds] = React.useState<number[]>([]);
  const [rfqLoading, setRfqLoading] = React.useState(false);
  const [rfqLineIds, setRfqLineIds] = React.useState<number[]>([]);

  // Список КП по заявке (логика работы с КП живёт здесь)
  const [quotes, setQuotes] = React.useState<QuoteSummary[]>([]);
  const [quotesLoading, setQuotesLoading] = React.useState(false);

  // Загрузка заявки
  React.useEffect(() => {
    setLoading(true);
    http
      .get(fixPath(`/api/procurement/purchase-requests/${id}/`))
      .then((response) => {
        const data = response.data;

        console.log('=== LOADED PR DATA ===', data);

        setComment(data.comment || '');
        setDeadline(dateOnly(data.deadline || data.deadline_at || data.due_date || data.required_by || ''));
        setStatus(data.status || '');

        // Извлекаем проект и этап
        const prId = pickId(
          data.project ??
          data.project_id ??
          data.project_display
        );
        const stId = pickId(
          data.stage ??
          data.stage_id ??
          data.stage_display ??
          data.project_stage ??
          data.project_stage_id ??
          data.project_stage_display
        );

        console.log('Extracted prId:', prId, 'stId:', stId);

        setProjectId(prId);
        setStageId(stId);
        setStatus(data.status || '');

        // Загружаем строки
        const rows = (data.lines || []).map((l: any) => ({
          id: l.id,
          item: l.item ?? null,
          itemName: l.item_name || (l.item ? l.item : undefined),
          categoryName: l.category_name || l.item_category_name,
          unit: l.unit ?? l.unit_id ?? null,
          unitName: l.unit_name,
          qty: l.qty,
          note: l.note ?? l.comment ?? '',
        }));

        setLines(rows.length ? rows : [{ item: null, qty: 1 }]);
      })
      .finally(() => setLoading(false));
  }, [id]);
  const loadQuotes = async (prId: string | undefined) => {
    if (!prId) {
      setQuotes([]);
      return;
    }
    setQuotesLoading(true);
    try {
      const res = await http.get(fixPath(`/api/procurement/quotes/?purchase_request_id=${prId}`));
      const data = res.data;
      const arr = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setQuotes(arr);
    } catch (e) {
      console.error('Failed to load quotes', e);
      setQuotes([]);
    } finally {
      setQuotesLoading(false);
    }
  };

  React.useEffect(() => {
    loadQuotes(id);
  }, [id]);


// Подтянуть названия проекта/этапа для верхней сводки и корректного отображения.
React.useEffect(() => {
  let alive = true;
  (async () => {
    if (!projectId) { if (alive) setProjectTitle(''); return; }
    const data = await tryGetJson([
      `/api/projects/projects/${projectId}/`,
      `/api/projects/${projectId}/`,
    ]);
    if (!alive) return;
    setProjectTitle(data ? (data.code ? `${data.code} — ${data.name ?? ''}` : (data.name ?? `#${projectId}`)) : `#${projectId}`);
  })();
  return () => { alive = false; };
}, [projectId]);

React.useEffect(() => {
  let alive = true;
  (async () => {
    if (!stageId) { if (alive) setStageTitle(''); return; }
    const data = await tryGetJson([
      `/api/projects/stages/${stageId}/`,
      `/api/projects/project-stages/${stageId}/`,
      `/api/projects/projectstages/${stageId}/`,
      `/api/projects/stage/${stageId}/`,
    ]);
    if (!alive) return;
    setStageTitle(data ? (data.code ? `${data.code} — ${data.name ?? ''}` : (data.name ?? `#${stageId}`)) : `#${stageId}`);
  })();
  return () => { alive = false; };
}, [stageId]);

  // Загрузка единиц измерения
  React.useEffect(() => {
    const loadUnits = async () => {
      const tryUrls = [
        fixPath('/api/core/units/?page_size=1000'),
        fixPath('/api/catalog/units/?page_size=1000'),
        fixPath('/api/units/?page_size=1000'),
      ];

      for (const url of tryUrls) {
        try {
          const response = await http.get(url);
          const data = response.data;
          const raw = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : data;

          if (raw && raw.length) {
            setUnits(
              raw.map((u: any) => ({
                id: u.id,
                name: u.name || u.title || u.code || String(u.id),
                code: u.code,
              }))
            );
            return;
          }
        } catch {
          // пробуем следующий URL
        }
      }
    };

    loadUnits();
  }, []);

  // Загрузка списка поставщиков (для запроса КП)
  React.useEffect(() => {
    if (!rfqOpen) return;

    let cancelled = false;
    const loadSuppliers = async () => {
      try {
        const res = await http.get(fixPath('/api/suppliers/'));
        const data = res.data;
        const raw = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        if (!cancelled) {
          setSuppliers(raw.map((s: any) => ({ id: s.id, name: s.name }))); 
        }
      } catch (e) {
        console.error('Load suppliers failed', e);
        if (!cancelled) setSuppliers([]);
      }
    };

    loadSuppliers();
    return () => {
      cancelled = true;
    };
  }, [rfqOpen]);

  // Можно ли редактировать (закрытые заявки редактировать нельзя)
  const canEdit = !['closed', 'done', 'approved', 'cancelled'].includes(
    status.toLowerCase()
  );
  const canSave =
    canEdit &&
    !!projectId &&
    !!stageId &&
    lines.some((l) => l.item !== null && l.qty > 0);

  // Выбор товара из каталога
  const onPick = (idx: number, res: CatalogPickResult) => {
    setPickIdx(null);
    setLines((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
            ...r,
            item: res.itemId,
            itemName: res.itemName,
            categoryName: res.categoryName || r.categoryName,
            unit: res.unitId ?? r.unit ?? null,
            unitName: res.unitName ?? r.unitName,
          }
          : r
      )
    );
  };

  // Добавить пустую строку
  const addLine = () => {
    setLines((prev) => [...prev, { item: null, qty: 1 }]);
  };

  const deadlineToIso = (d: string): string | null => {
    if (!d) return null;
    return `${d}T12:00:00Z`;
  };

  // Сохранение
  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        comment,
        project_id: projectId,
        project_stage_id: stageId,
        deadline: deadlineToIso(deadline),
        lines: lines
          .filter((l) => l.item !== null && l.qty > 0)
          .map((l) => {
            const base: any = {
              id: l.id,
              item: l.item,
              qty: l.qty,
              comment: l.note,
            };
            if (l.unit) base.unit = l.unit;
            return base;
          }),
      };

      const res = await http.patch(
        fixPath(`/api/procurement/purchase-requests/${id}/`),
        payload
      );

      console.log('=== EDIT: SUCCESS ===', res.data);
      nav('/pr');
    } catch (e: any) {
      console.error('Edit save error:', e);
      alert('Ошибка: ' + (e?.response?.data || e?.message));
    } finally {
      setSaving(false);
    }
  };

  // Запрос КП у выбранных поставщиков
  const requestQuotes = async () => {
    if (!id) return;
    if (!supplierIds.length) {
      alert('Выберите хотя бы одного поставщика');
      return;
    }

    setRfqLoading(true);
    try {
      const res = await http.post(
        fixPath('/api/procurement/quotes/generate-from-request/'),
        {
          purchase_request_id: Number(id),
          supplier_ids: supplierIds,
          purchase_request_line_ids: rfqLineIds,
        }
      );

      const warnings = res.data?.warnings || [];
      if (warnings.length) {
        alert('КП созданы, но есть предупреждения:\n\n' + warnings.join('\n'));
      } else {
        alert('КП созданы');
      }

      setRfqOpen(false);
      setSupplierIds([]);
      loadQuotes(id);
    } catch (e: any) {
      console.error('Generate quotes failed', e);
      alert('Ошибка запроса КП: ' + (e?.response?.data?.detail || e?.message));
    } finally {
      setRfqLoading(false);
    }
  };
  const openQuote = (quoteId: number) => {
    nav(`/quotes?quote_id=${quoteId}`);
  };

  const createOrderFromQuote = async (quoteId: number) => {
    if (!quoteId) return;
    try {
      const res = await http.post(fixPath(`/api/procurement/quotes/${quoteId}/create_po/`));
      const poId = res.data?.id || res.data?.order_id || res.data?.purchase_order_id;
      if (poId) {
        nav(`/po?order_id=${poId}`);
      } else {
        alert('Заказ создан');
        nav('/po');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data || e?.message || 'Не удалось сформировать заказ';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      // Обновим список КП (на случай lock/изменений)
      loadQuotes(id);
    }
  };

  const deleteQuote = async (quoteId: number) => {
    if (!quoteId) return;
    if (!confirm('Удалить КП?')) return;
    try {
      await http.delete(fixPath(`/api/procurement/quotes/${quoteId}/`));
      loadQuotes(id);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data || e?.message || 'Не удалось удалить КП';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };


  return (
    <Box sx={pageSx}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          {/* Заголовок */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Редактирование заявки #{id}</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                onClick={() => { setRfqLineIds(lines.map((l) => Number(l.id)).filter((n) => Number.isFinite(n))); setRfqOpen(true); }}
                variant="outlined"
                disabled={!id}
              >
                Запросить КП
              </Button>
              <Button
                onClick={save}
                variant="contained"
                disabled={!canSave || saving}
              >
                Сохранить
              </Button>
            </Stack>
          </Stack>

          {/* Информация о проекте и этапе */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: '#f9f9f9' }}>
            <Stack direction="row" spacing={3}>

              <Box sx={{ minWidth: 320 }}>
                <ProjectSelect
                  value={projectId}
                  onChange={setProjectId}
                  disabled={!canEdit}
                  label="Проект"
                />
              </Box>

              <Box sx={{ minWidth: 320 }}>
                <ProjectStageSelect
                  projectId={projectId}
                  value={stageId}
                  onChange={setStageId}
                  disabled={!canEdit}
                  label="Этап"
                />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Дата создания
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {formatDateTime(createdAt)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Статус
                </Typography>
                <Typography variant="body1">{statusRu(status)}</Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Форма редактирования */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Комментарий"
              size="small"
              fullWidth
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={!canEdit}
            />
            <TextField
              label="Дедлайн"
              type="date"
              size="small"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              sx={{ minWidth: 200 }}
              disabled={!canEdit}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          {/* Строки заявки */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle1">Позиции</Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addLine}
              disabled={!canEdit}
            >
              Добавить
            </Button>
          </Stack>

          <Table size="small" aria-label="lines">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 28 }} align="right">
                  №
                </TableCell>
                <TableCell sx={{ width: 220 }}>Категория</TableCell>
                <TableCell>Номенклатура</TableCell>
                <TableCell sx={{ width: 56 }} align="center">
                  ☰
                </TableCell>
                <TableCell sx={{ width: 140 }}>Ед.изм</TableCell>
                <TableCell sx={{ width: 100 }} align="right">
                  Кол-во
                </TableCell>
                <TableCell sx={{ width: 260 }}>Примечание</TableCell>
                <TableCell sx={{ width: 56 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((row, idx) => (
                <TableRow key={row.id ?? idx}>
                  {/* № */}
                  <TableCell align="right">{idx + 1}</TableCell>

                  {/* RO Категория */}
                  <TableCell>{row.categoryName || '—'}</TableCell>

                  {/* RO Номенклатура */}
                  <TableCell>
                    {row.itemName || (row.item ? row.item : '—')}
                  </TableCell>

                  {/* Кнопка выбора товара */}
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => setPickIdx(idx)}
                      aria-label="Выбрать товар"
                      disabled={!canEdit}
                    >
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                  </TableCell>

                  {/* Единица измерения */}
                  <TableCell>
                    <FormControl size="small" fullWidth disabled={!canEdit}>
                      <InputLabel id={`unit-${idx}`}>Ед.изм</InputLabel>
                      <Select
                        labelId={`unit-${idx}`}
                        label="Ед.изм"
                        value={row.unit ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          const u = units.find((u) => u.id === Number(val));
                          setLines((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, unit: val, unitName: u?.name }
                                : r
                            )
                          );
                        }}
                      >
                        <MenuItem value="">—</MenuItem>
                        {units.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            {u.name}
                            {u.code ? ` (${u.code})` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>

                  {/* Количество */}
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ min: 0, step: 0.01 }}
                      value={row.qty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, qty: Number(e.target.value) } : r
                          )
                        )
                      }
                      disabled={!canEdit}
                    />
                  </TableCell>

                  {/* Примечание */}
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.note ?? ''}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, note: e.target.value } : r
                          )
                        )
                      }
                      disabled={!canEdit}
                    />
                  </TableCell>

                  {/* Удалить */}
                  <TableCell>
                    <IconButton
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== idx))
                      }
                      size="small"
                      disabled={!canEdit}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог выбора товара */}
      <CatalogPickDialog
        open={pickIdx !== null}
        onClose={() => setPickIdx(null)}
        onSelect={(res) => {
          if (pickIdx !== null) onPick(pickIdx, res);
        }}
      />

      {/* Диалог: запросить КП у поставщиков */}
      
          {/* Коммерческие предложения (КП) по заявке */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Коммерческие предложения</Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => loadQuotes(id)}
                disabled={quotesLoading || !id}
              >
                Обновить
              </Button>
            </Stack>

            {quotesLoading ? (
              <Typography variant="body2" color="text.secondary">Загрузка…</Typography>
            ) : !quotes.length ? (
              <Typography variant="body2" color="text.secondary">КП пока нет.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 72 }}>КП</TableCell>
                    <TableCell>Поставщик</TableCell>
                    <TableCell sx={{ width: 140 }}>Статус</TableCell>
                    <TableCell sx={{ width: 160 }}>Сумма</TableCell>
                    <TableCell sx={{ width: 140 }}>Получено</TableCell>
                    <TableCell align="right" sx={{ width: 260 }}>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id} hover>
                      <TableCell>#{q.id}</TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.supplier_name || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={quoteStatusLabels[q.status || ''] || q.status || '—'} />
                      </TableCell>
                      <TableCell>{fmtMoney(q.total_price, q.currency)}</TableCell>
                      <TableCell>{q.received_at ? String(q.received_at).slice(0, 10) : '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNewIcon fontSize="small" />}
                            onClick={() => openQuote(q.id)}
                          >
                            Открыть КП
                          </Button>
                          <Button size="small" variant="contained" onClick={() => createOrderFromQuote(q.id)}>
                            В заказ
                          </Button>
                          <IconButton size="small" color="error" onClick={() => deleteQuote(q.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

<Dialog open={rfqOpen} onClose={() => setRfqOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Запросить КП</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Выберите поставщиков, у которых запросить КП по заявке #{id}.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="suppliers-multi">Поставщики</InputLabel>
            <Select
              labelId="suppliers-multi"
              multiple
              value={supplierIds}
              label="Поставщики"
              renderValue={(selected) =>
                suppliers
                  .filter((s) => selected.includes(s.id))
                  .map((s) => s.name)
                  .join(', ')
              }
              onChange={(e) => {
                const val = e.target.value as any;
                const arr = Array.isArray(val) ? val.map(Number) : [];
                setSupplierIds(arr);
              }}
            >
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  <Checkbox checked={supplierIds.includes(s.id)} />
                  <ListItemText primary={s.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        

<Divider sx={{ my: 2 }} />
<Typography variant="subtitle2">Позиции заявки</Typography>
<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
  Выберите позиции, по которым запросить КП (по умолчанию — все).
</Typography>

<Stack direction="row" spacing={1} sx={{ mb: 1 }}>
  <Button
    size="small"
    onClick={() => setRfqLineIds(lines.map((l) => Number(l.id)).filter((n) => Number.isFinite(n)))}
  >
    Выбрать все
  </Button>
  <Button size="small" onClick={() => setRfqLineIds([])}>
    Снять выбор
  </Button>
</Stack>

<Table size="small">
  <TableHead>
    <TableRow>
      <TableCell padding="checkbox" />
      <TableCell>Номенклатура</TableCell>
      <TableCell>Категория</TableCell>
      <TableCell align="right">Кол-во</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {lines.map((l, idx) => {
      const idv = Number(l.id);
                const hasId = Number.isFinite(idv);
                const checked = hasId && rfqLineIds.includes(idv);
      return (
        <TableRow key={idv} hover>
          <TableCell padding="checkbox">
            <Checkbox
                        checked={checked}
                        disabled={!hasId}
                        onChange={() => {
                          if (!hasId) return;
                          setRfqLineIds((prev) =>
                            checked ? prev.filter((x) => x !== idv) : [...prev, idv]
                          );
                        }}
                      />
          </TableCell>
          <TableCell>{l.itemName || l.item || '—'}</TableCell>
          <TableCell>{l.categoryName || '—'}</TableCell>
          <TableCell align="right">{l.qty}</TableCell>
        </TableRow>
      );
    })}
  </TableBody>
</Table>
</DialogContent>
        <DialogActions>
          <Button onClick={() => setRfqOpen(false)} disabled={rfqLoading}>Отмена</Button>
          <Button onClick={requestQuotes} variant="contained" disabled={rfqLoading}>
            Создать КП
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

