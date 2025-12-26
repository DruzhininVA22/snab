/**
 * Дерево категорий номенклатуры.
 *
 * Показывает иерархию категорий, используемую для классификации материалов.
 */

import * as React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, List, ListItemButton, ListItemText, Collapse, TextField, Chip, Divider } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { http, fixPath } from '../../api/_http';

type Brief = { id:number; code:string; name:string };
type Cat = {
  id:number; code:string; name:string;
  parent?: Brief | null;
  includes?: string; excludes?: string; borderline?: string;
};

function buildTree(items: Cat[]) {
  const byId: Record<number, any> = {};
  const roots: any[] = [];
  items.forEach(it => byId[it.id] = { ...it, children: [] });
  items.forEach(it => {
    const node = byId[it.id];
    const pid = (it as any).parent?.id ?? null;
    if (pid && byId[pid]) byId[pid].children.push(node);
    else roots.push(node);
  });
  const sortRec = (arr:any[]) => { arr.sort((a,b)=> (a.code||'').localeCompare(b.code||'')); arr.forEach(n=> sortRec(n.children)); };
  sortRec(roots);
  return roots;
}

export default function CategoriesTreePage() {
  const [data, setData] = React.useState<Cat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  const [selected, setSelected] = React.useState<any | null>(null);

  React.useEffect(() => {
    setLoading(true);
    http.get(fixPath('/api/catalog/categories/'), { params: { page_size: 3000 } })
      .then(({ data }) => {
        const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
        setData((arr || []) as Cat[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const tree = React.useMemo(() => buildTree(data), [data]);
  const toggle = (id:number) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));
  const matches = (node:any, q:string) => {
    if (!q) return true;
    return (`${node.code} ${node.name} ${node.includes||''} ${node.excludes||''} ${node.borderline||''}`).toLowerCase().includes(q.toLowerCase());
  };

  const onClickNode = (node:any) => {
    setSelected(node);
    if ((node.children||[]).length) toggle(node.id);
  };

  const renderNode = (node:any, depth=0) => {
    const hasChildren = (node.children || []).length > 0;
    if (!matches(node, filter) && hasChildren && !node.children.some((ch:any)=> matches(ch, filter))) return null;
    return (
      <React.Fragment key={node.id}>
        <ListItemButton onClick={()=> onClickNode(node)} sx={{ pl: 2 + depth * 2 }} selected={selected?.id===node.id}>
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

  const excludes = selected?.excludes || '';
  const notes = selected?.borderline || '';

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Дерево категорий</Typography>
          <TextField size="small" fullWidth label="Фильтр (код/название/подсказки)" value={filter} onChange={(e)=> setFilter(e.target.value)} sx={{ mb: 2 }} />
          <List dense>
            {tree.map(n => renderNode(n))}
          </List>
        </CardContent>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Рекомендации {selected ? <Chip size="small" label={`${selected.code} — ${selected.name}`} sx={{ ml: 1 }} /> : null}</Typography>
          {!selected ? (
            <Typography color="text.secondary">Выберите раздел слева, чтобы увидеть рекомендации.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.5 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: .5 }}>Что должно входить</Typography>
                <Typography variant="body2" color="text.secondary">{selected?.includes || '—'}</Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: .5 }}>Что не должно входить</Typography>
                <Typography variant="body2" color="text.secondary">{notes ? (selected?.excludes || '').replace(/\s*Пограничное:.*/i, '').trim() : (selected?.excludes || '—')}</Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: .5 }}>Пограничные значения</Typography>
                <Typography variant="body2" color="text.secondary">{notes || '—'}</Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
