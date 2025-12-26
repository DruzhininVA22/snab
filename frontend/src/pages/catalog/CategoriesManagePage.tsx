/**
 * Управление категориями.
 *
 * Страница для администраторов/специалистов: создание/переименование/перемещение категорий.
 */
import * as React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, TextField, Button, Stack, List, ListItemButton, ListItemText, Collapse, Divider, MenuItem } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { http, fixPath } from '../../api/_http';

type Cat = {
  id?: number;
  code: string;
  name: string;
  description?: string;
  includes?: string;
  excludes?: string;
  borderline?: string;
  parent?: { id:number, code:string, name:string } | null;
  is_leaf?: boolean;
  level?: number;
  path?: string;
};

function buildTree(items: Cat[]) {
  const byId: Record<number, any> = {};
  const roots: any[] = [];
  items.forEach(it => { if (it.id) byId[it.id] = { ...it, children: [] }; });
  items.forEach(it => {
    if (!it.id) return;
    const node = byId[it.id];
    const pid = (it as any).parent?.id ?? null;
    if (pid && byId[pid]) byId[pid].children.push(node);
    else roots.push(node);
  });
  const sortRec = (arr:any[]) => { arr.sort((a,b)=> (a.code||'').localeCompare(b.code||'')); arr.forEach(n=> sortRec(n.children)); };
  sortRec(roots);
  return roots;
}

export default function CategoriesManagePage() {
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Cat[]>([]);
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  const [filter, setFilter] = React.useState('');
  const [selected, setSelected] = React.useState<Cat | null>(null);
  const [form, setForm] = React.useState<Cat | null>(null);
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => {
    setLoading(true);
    http.get(fixPath('/api/catalog/categories/'), { params: { page_size: 2000 } })
      .then(({ data }) => {
        const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
        setItems(arr || []);
      })
      .finally(()=> setLoading(false));
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const tree = React.useMemo(()=> buildTree(items), [items]);

  const onSelect = (node:any) => {
    setSelected(node);
    setForm({
      id: node.id, code: node.code, name: node.name,
      description: node.description || '',
      includes: node.includes || '',
      excludes: node.excludes || '',
      borderline: node.borderline || '',
      parent: node.parent || null,
    });
    if ((node.children||[]).length) setOpen(prev => ({ ...prev, [node.id]: !prev[node.id] }));
  };

  const renderNode = (node:any, depth=0) => {
    const hasChildren = (node.children || []).length > 0;
    const matches = (node.code + ' ' + node.name).toLowerCase().includes(filter.trim().toLowerCase());
    if (!matches && hasChildren && !node.children.some((ch:any)=> (ch.code + ' ' + ch.name).toLowerCase().includes(filter.trim().toLowerCase()))) return null;
    return (
      <React.Fragment key={node.id}>
        <ListItemButton onClick={()=> onSelect(node)} sx={{ pl: 2 + depth * 2 }} selected={selected?.id===node.id}>
          {hasChildren ? (open[node.id] ? <ExpandLess /> : <ExpandMore />) : <span style={{ width: 24 }} />}
          <ListItemText primary={`${node.code} — ${node.name}`} />
        </ListItemButton>
        {hasChildren && (
          <Collapse in={open[node.id]} timeout="auto" unmountOnExit>
            <List disablePadding>
              {node.children.map((ch:any)=> renderNode(ch, depth+1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const setField = (k: keyof Cat, v: any) => setForm(prev => ({ ...(prev as any), [k]: v }));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload: any = {
        code: form.code, name: form.name,
        description: form.description || '',
        includes: form.includes || '',
        excludes: form.excludes || '',
        borderline: form.borderline || '',
      };
      if (form.parent?.id) payload.parent_id = form.parent.id;
      if (form.id) {
        await http.patch(fixPath(`/api/catalog/categories/${form.id}/`), payload);
      } else {
        await http.post(fixPath('/api/catalog/categories/'), payload);
      }
      reload();
    } catch {
      alert('Не удалось сохранить категорию (проверьте уникальность кода и валидность H/S).');
    } finally {
      setSaving(false);
    }
  };

  const makeNewFamily = () => {
    setSelected(null);
    setForm({ code: '', name: '', description: '', includes: '', excludes: '', borderline: '', parent: null });
  };
  const makeNewLeaf = () => {
    const parent = selected && String(selected.code||'').startsWith('H') ? selected : null;
    setSelected(null);
    setForm({ code: '', name: '', description: '', includes: '', excludes: '', borderline: '', parent });
  };

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Категории (управление)</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={makeNewFamily}>+ Заглавие (Hxx)</Button>
              <Button onClick={makeNewLeaf}>+ Раздел (Sxx)</Button>
            </Stack>
          </Stack>
          <TextField size="small" label="Фильтр по коду/названию" value={filter} onChange={(e)=> setFilter(e.target.value)} fullWidth sx={{ mb: 2 }} />
          <List dense>
            {tree.map(n => renderNode(n))}
          </List>
        </CardContent>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{form?.id ? `Редактирование ${form.code}` : 'Новая категория'}</Typography>
          {!form ? (
            <Typography color="text.secondary">Выберите узел слева или создайте новую категорию.</Typography>
          ) : (
            <Stack spacing={1.5}>
              <TextField size="small" label="Код (Hxx или Sxx/SA/SB/SC)" value={form.code} onChange={(e)=> setField('code', e.target.value)} />
              <TextField size="small" label="Наименование" value={form.name} onChange={(e)=> setField('name', e.target.value)} />
              <TextField size="small" label="Описание" value={form.description} onChange={(e)=> setField('description', e.target.value)} multiline minRows={2} />
              <Divider flexItem />
              <TextField size="small" label="Что должно входить" value={form.includes} onChange={(e)=> setField('includes', e.target.value)} multiline minRows={2} />
              <TextField size="small" label="Что не должно входить" value={form.excludes} onChange={(e)=> setField('excludes', e.target.value)} multiline minRows={2} />
              <TextField size="small" label="Пограничные значения" value={form.borderline} onChange={(e)=> setField('borderline', e.target.value)} multiline minRows={2} />
              <Divider flexItem />
              <Stack direction="row" spacing={1}>
                <Button onClick={save} variant="contained" disabled={saving || !form.code || !form.name}>Сохранить</Button>
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
