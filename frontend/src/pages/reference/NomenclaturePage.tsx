/**
 * Справочник "Номенклатура" (Items).
 *
 * Отображает список позиций и обеспечивает базовые операции: поиск/фильтр/переход к редактированию.
 */
import * as React from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableRow, TableCell, TableBody, MenuItem, Select, FormControl, InputLabel, FormHelperText, Stack
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { http, fixPath } from '../../api/_http';
import CategoryTreeSelect from '../../components/CategoryTreeSelect';

type Unit = { id: number; name: string };
type Item = {
  id: number;
  sku?: string;
  name: string;
  unit: number;
  unit_name?: string;
  category?: string | number | null;
  category_code?: string;
  category_name?: string;
};

async function fetchUnits(): Promise<Unit[]> {
  const { data } = await http.get(fixPath('/api/units/'), { params: { page_size: 1000 } });
  const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
  return (arr || []).map((u: any) => ({ id: u.id, name: u.name ?? String(u.id) }));
}

async function fetchItems(): Promise<Item[]> {
  const { data } = await http.get(fixPath('/api/items/'), { params: { page_size: 500 } });
  const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
  return (arr || []);
}

function useUnits() {
  const [units, setUnits] = React.useState<Unit[]>([]);
  React.useEffect(() => { fetchUnits().then(setUnits).catch(() => setUnits([])); }, []);
  return units;
}

function ItemFormDialog({ open, onClose, initial, onSaved }: {
  open: boolean;
  onClose: () => void;
  initial: Partial<Item> | null;
  onSaved: (it: Item) => void;
}) {
  const units = useUnits();
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [skuChecking, setSkuChecking] = React.useState(false);
  const [form, setForm] = React.useState<Partial<Item>>(
    initial || { name: '', sku: '', unit: units[0]?.id, category: null }
  );

  React.useEffect(() => {
    setForm(initial || { name: '', sku: '', unit: units[0]?.id, category: null });
  }, [initial, units]);

  const setField = (k: keyof Item, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => {
      if (!prev[k as any]) return prev;
      const next = { ...prev } as any;
      delete next[k as any];
      return next;
    });
  };

  const norm = (v: any) => (v ?? '').toString().trim();



const validateLocal = () => {
  const next: Record<string, string> = {};
  const name = norm(form.name);
  const sku = norm(form.sku);

  if (!name) next.name = 'Наименование обязательно';
  if (!sku) next.sku = 'Артикул (SKU) обязателен';
  if (!form.unit) next.unit = 'Ед. изм. обязательна';
  if (!form.category) next.category = 'Категория обязательна';

  setErrors((prev) => ({ ...prev, ...next }));
  return next;
};

const checkSkuUnique = async () => {
  const sku = norm(form.sku);
  if (!sku) return false;

  // при редактировании допускаем "свой" артикул
  if (initial?.id && norm(initial.sku).toUpperCase() === sku.toUpperCase()) return true;

  setSkuChecking(true);
  try {
    const res = await http.get(fixPath('/api/items/'), { params: { search: sku, page_size: 50 } });
    const arr = Array.isArray((res.data as any)?.results) ? (res.data as any).results : (res.data as any);
    const found = (arr || []).some((it: any) => norm(it?.sku).toUpperCase() === sku.toUpperCase());
    if (found) {
      setErrors((prev) => ({ ...prev, sku: 'Артикул уже используется в номенклатуре' }));
      return false;
    }
    // очистим ошибку sku, если была
    setErrors((prev) => {
      const { sku: _sku, ...rest } = prev;
      return rest;
    });
    return true;
  } catch {
    // не блокируем сохранение, но и не гарантируем уникальность
    return true;
  } finally {
    setSkuChecking(false);
  }
};

  const submit = async () => {
    // client-side validation (чтобы не получать "Не удалось сохранить" без подсказок)
    setErrors({});
    const localErrors = validateLocal();
    if (Object.keys(localErrors).length) {
      alert('Заполните обязательные поля');
      return;
    }
    const skuOk = await checkSkuUnique();
    if (!skuOk) {
      alert('Проверьте артикул (SKU)');
      return;
    }

    
  setSaving(true);
  try {
    const payload: any = {
      name: norm(form.name),
      sku: norm(form.sku),
      unit: form.unit,
      category: form.category,
    };

    if (initial && initial.id) {
      const { data } = await http.patch(fixPath(`/api/items/${initial.id}/`), payload);
      onSaved(data);
    } else {
      const { data } = await http.post(fixPath('/api/items/'), payload);
      onSaved(data);
    }
    onClose();
  } catch (e: any) {
    // Покажем пользователю причину (валидация/уникальность), а не общий текст
    const data = e?.response?.data;
    const next: Record<string, string> = {};

    const pushField = (k: string, v: any) => {
      if (Array.isArray(v)) next[k] = v.join(' ');
      else if (typeof v === 'string') next[k] = v;
      else if (v != null) next[k] = String(v);
    };

    if (data && typeof data === 'object') {
      Object.keys(data).forEach((k) => pushField(k, (data as any)[k]));
    }

    if (Object.keys(next).length) {
      setErrors((prev) => ({ ...prev, ...next }));
      const msg = Object.entries(next)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      alert('Ошибка сохранения:\n' + msg);
    } else {
      alert('Не удалось сохранить номенклатуру: ' + (e?.message || 'unknown'));
    }
  } finally {
    setSaving(false);
  }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial?.id ? 'Редактировать номенклатуру' : 'Новая номенклатура'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Наименование"
            error={!!errors.name}
            helperText={errors.name || ""}
            value={form.name ?? ''}
            onChange={(e) => setField('name', e.target.value)}
            fullWidth
            size="small"
          />
          {'sku' in (initial || {}) || true ? (
            <TextField
              label="Артикул (SKU)"
              error={!!errors.sku}
              helperText={errors.sku || (skuChecking ? "Проверка уникальности..." : "")}
              onBlur={() => { void checkSkuUnique(); }}
              value={form.sku ?? ''}
              onChange={(e) => setField('sku', e.target.value)}
              fullWidth
              size="small"
            />
          ) : null}
          <FormControl fullWidth size="small" error={!!errors.unit}>
            <InputLabel id="unit-label">Ед. изм.</InputLabel>
            <Select
              labelId="unit-label"
              label="Ед. изм."
              value={form.unit ?? ''}
              onChange={(e) => setField('unit', Number(e.target.value))}
            >
              {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </Select>
            <FormHelperText>{errors.unit || ""}</FormHelperText>
          </FormControl>

          {/* Новый выбор категории: дерево H→S в отдельном диалоге с рекомендациями */}
          <CategoryTreeSelect
            value={form.category ? (typeof form.category === 'string' ? Number(form.category) : form.category) : null}
            onChange={(id) => setField('category', id)}
            label="Категория (Sxx)"
          />

          {errors.category ? (
            <Typography variant="body2" color="error">
              {errors.category}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          onClick={submit}
          disabled={
            saving ||
            skuChecking ||
            !norm(form.name) ||
            !norm(form.sku) ||
            !form.unit ||
            !form.category ||
            !!errors.name ||
            !!errors.sku ||
            !!errors.unit ||
            !!errors.category
          }
          variant="contained"
        >
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ItemsListPage() {
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<Item[]>([]);
  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Item | null>(null);

  const reload = React.useCallback(() => {
    setLoading(true);
    fetchItems().then(setRows).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const onEdit = (it: Item) => { setEditing(it); setDlgOpen(true); };
  const onAdd = () => { setEditing(null); setDlgOpen(true); };

  const upsertLocal = (saved: Item) => {
    setRows(prev => {
      const i = prev.findIndex(p => p.id === saved.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Номенклатура</Typography>
            <Button startIcon={<AddIcon />} onClick={onAdd} variant="contained">Добавить</Button>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Артикул</TableCell>
                <TableCell>Наименование</TableCell>
                <TableCell>Ед. изм.</TableCell>
                <TableCell>Категория</TableCell>
                <TableCell width={72}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id} hover>
                  {/* ID */}
                  <TableCell>{row.id}</TableCell>
                  {/* Артикул */}
                  <TableCell>{row.sku || ''}</TableCell>
                  {/* Наименование */}
                  <TableCell>{row.name}</TableCell>
                  {/* Ед. изм. */}
                  <TableCell>{row.unit_name || ''}</TableCell>
                  {/* Категория */}
                  <TableCell>
                    {row.category_code && row.category_name
                      ? `${row.category_code} ${row.category_name}`
                      : row.category_name || ''}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => onEdit(row)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </CardContent>
      </Card>

      <ItemFormDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        initial={editing}
        onSaved={upsertLocal}
      />
    </Box>
  );
}
