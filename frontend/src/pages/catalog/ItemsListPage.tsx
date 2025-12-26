/**
 * Справочник "Номенклатура" (Items).
 *
 * Отображает список позиций и обеспечивает базовые операции: поиск/фильтр/переход к редактированию.
 */
import * as React from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableRow, TableCell, TableBody, MenuItem, Select, FormControl, InputLabel, Stack
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
  unit_display?: { id:number, name:string } | null;
  category?: string | number | null;
  category_display?: { id:number, name:string } | null;
};

async function fetchUnits(): Promise<Unit[]> {
  const { data } = await http.get(fixPath('/api/units/'), { params: { page_size: 1000 } });
  const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
  return (arr || []).map((u:any)=> ({ id: u.id, name: u.name ?? String(u.id) }));
}

async function fetchItems(): Promise<Item[]> {
  const { data } = await http.get(fixPath('/api/items/'), { params: { page_size: 500 } });
  const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
  return (arr || []);
}

function useUnits() {
  const [units, setUnits] = React.useState<Unit[]>([]);
  React.useEffect(()=> { fetchUnits().then(setUnits).catch(()=> setUnits([])); }, []);
  return units;
}

function ItemFormDialog({ open, onClose, initial, onSaved } : {
  open: boolean;
  onClose: ()=>void;
  initial: Partial<Item> | null;
  onSaved: (it: Item)=>void;
}) {
  const units = useUnits();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<Partial<Item>>(
    initial || { name: '', sku: '', unit: units[0]?.id, category: null }
  );

  React.useEffect(()=> {
    setForm(initial || { name: '', sku: '', unit: units[0]?.id, category: null });
  }, [initial, units]);

  const setField = (k: keyof Item, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        unit: form.unit,
      };
      if (typeof form.sku !== 'undefined') payload.sku = form.sku;
      // serializer ожидает category как строковый ID (мы передадим число — бек примет, он сам приведёт в строку)
      if (typeof form.category !== 'undefined') payload.category = form.category ?? '';

      if (initial && initial.id) {
        const { data } = await http.patch(fixPath(`/api/items/${initial.id}/`), payload);
        onSaved(data);
      } else {
        const { data } = await http.post(fixPath('/api/items/'), payload);
        onSaved(data);
      }
      onClose();
    } catch (e) {
      alert('Не удалось сохранить номенклатуру');
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
            value={form.name ?? ''}
            onChange={(e)=> setField('name', e.target.value)}
            fullWidth
            size="small"
          />
          {'sku' in (initial||{}) || true ? (
            <TextField
              label="Артикул (SKU)"
              value={form.sku ?? ''}
              onChange={(e)=> setField('sku', e.target.value)}
              fullWidth
              size="small"
            />
          ) : null}
          <FormControl fullWidth size="small">
            <InputLabel id="unit-label">Ед. изм.</InputLabel>
            <Select
              labelId="unit-label"
              label="Ед. изм."
              value={form.unit ?? ''}
              onChange={(e)=> setField('unit', Number(e.target.value))}
            >
              {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </Select>
          </FormControl>

          {/* Новый выбор категории: дерево H→S в отдельном диалоге с рекомендациями */}
          <CategoryTreeSelect
            value={form.category ? (typeof form.category === 'string' ? Number(form.category) : form.category) : null}
            onChange={(id)=> setField('category', id)}
            label="Категория (Sxx)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={submit} disabled={saving || !form.name || !form.unit} variant="contained">
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
    fetchItems().then(setRows).finally(()=> setLoading(false));
  }, []);

  React.useEffect(()=> { reload(); }, [reload]);

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
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.sku || ''}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.unit_display?.name || row.unit}</TableCell>
                  <TableCell>{row.category_display?.name || row.category || ''}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={()=> onEdit(row)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </CardContent>
      </Card>

      <ItemFormDialog
        open={dlgOpen}
        onClose={()=> setDlgOpen(false)}
        initial={editing}
        onSaved={upsertLocal}
      />
    </Box>
  );
}
