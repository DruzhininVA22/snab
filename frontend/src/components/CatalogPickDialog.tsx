/**
 * Универсальный диалог выбора сущности из справочника (каталог).
 *
 * Используется там, где нужно выбрать материал/номенклатуру/категорию без перехода на отдельную страницу.
 * Компонент изолирует UI-паттерн: поиск/список/выбор + возврат результата в родительскую форму.
 */
import * as React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Button, TextField, List, ListItemButton, ListItemText,
    CircularProgress, Typography, Divider, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import { http, fixPath } from '../api/_http';

type Category = {
    id: number;
    name: string;
    parent?: number | null;
    is_leaf?: boolean;
    path?: string | null;
};

type ItemRow = {
    id: number;
    name: string;
    category?: number | null;
    category_name?: string | null;
    unit?: number | null;
    unit_name?: string | null;
};

export type CatalogPickResult = {
    itemId: number;
    itemName: string;
    categoryId: number | null;
    categoryName: string | null;
    unitId: number | null;
    unitName: string | null;
};

export default function CatalogPickDialog(props: {
    open: boolean;
    value?: number | null; // начальный выбранный item (необязательно)
    onClose: () => void;
    onSelect: (result: CatalogPickResult) => void;
}) {
    const { open, onClose, onSelect } = props;

    const [loadingCats, setLoadingCats] = React.useState(false);
    const [cats, setCats] = React.useState<Category[]>([]);
    const [tree, setTree] = React.useState<Array<{ cat: Category; depth: number; hasChildren: boolean }>>([]);
    const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
    const [selectedCatId, setSelectedCatId] = React.useState<number | null>(null);

    const [search, setSearch] = React.useState('');
    const [loadingItems, setLoadingItems] = React.useState(false);
    const [items, setItems] = React.useState<ItemRow[]>([]);
    const [selectedItemId, setSelectedItemId] = React.useState<number | null>(null);

    // --- fetch helpers ---
    const fetchCategories = React.useCallback(async () => {
        setLoadingCats(true);
        const tryUrls = [
            fixPath('/api/catalog/categories/?page_size=1000'),
            fixPath('/api/core/categories/?page_size=1000'),
            fixPath('/api/categories/?page_size=1000'),
        ];
        for (const url of tryUrls) {
            try {
                const { data } = await http.get(url);
                const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
                if (raw.length) {
                    const mapped: Category[] = raw.map((r: any) => ({
                        id: r.id,
                        name: r.name || r.title || r.code || `#${r.id}`,
                        parent: r.parent ?? r.parent_id ?? null,
                        is_leaf: r.is_leaf ?? !!r.isLeaf ?? (r.level ? r.level > 0 : undefined),
                        path: r.path ?? null,
                    }));
                    setCats(mapped);
                    return;
                }
            } catch { }
        }
        setCats([]);
        setLoadingCats(false);
    }, []);

    const fetchItems = React.useCallback(async (categoryId: number | null, q: string) => {
        setLoadingItems(true);
        try {
            const params: string[] = ['page_size=100'];
            if (categoryId) params.push(`category=${categoryId}`);
            if (q.trim()) params.push(`search=${encodeURIComponent(q.trim())}`);
            const tryUrls = [
                fixPath(`/api/catalog/items/?${params.join('&')}`),
                fixPath(`/api/items/?${params.join('&')}`),
            ];
            for (const url of tryUrls) {
                try {
                    const { data } = await http.get(url);
                    const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
                    if (raw.length || data) {
                        const mapped: ItemRow[] = raw.map((r: any) => ({
                            id: r.id,
                            name: r.name || r.title || r.display || r.code || `#${r.id}`,
                            category: r.category ?? r.category_id ?? null,
                            category_name: r.category_name ?? r.category?.name ?? null,
                            unit: r.unit ?? r.unit_id ?? null,
                            unit_name: r.unit_name ?? null,
                        }));
                        setItems(mapped);
                        setLoadingItems(false);
                        return;
                    }
                } catch { }
            }
            setItems([]);
        } finally {
            setLoadingItems(false);
        }
    }, []);

    // --- build tree list ---
    React.useEffect(() => {
        if (!cats.length) { setTree([]); return; }
        const byParent: Record<number, Category[]> = {};
        cats.forEach(c => {
            const p = c.parent ?? 0;
            if (!byParent[p]) byParent[p] = [];
            byParent[p].push(c);
        });
        Object.values(byParent).forEach(arr => arr.sort((a, b) => (a.name || '').localeCompare(b.name || '')));

        const out: Array<{ cat: Category; depth: number; hasChildren: boolean }> = [];
        const walk = (parentId: number, depth: number) => {
            const arr = byParent[parentId] || [];
            for (const c of arr) {
                const kids = byParent[c.id] || [];
                out.push({ cat: c, depth, hasChildren: kids.length > 0 });
                if (expanded[c.id] || depth === 0) {
                    // корневые — развернуты по умолчанию
                    if (expanded[c.id] === undefined && depth === 0) expanded[c.id] = true;
                    walk(c.id, depth + 1);
                }
            }
        };
        walk(0, 0);
        setTree([...out]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cats, expanded]);

    // --- lifecycle ---
    React.useEffect(() => {
        if (open) {
            setSelectedItemId(null);
            setSearch('');
            fetchCategories().finally(() => setLoadingCats(false));
            setItems([]);
        }
    }, [open, fetchCategories]);

    React.useEffect(() => {
        fetchItems(selectedCatId, search);
    }, [selectedCatId, search, fetchItems]);

    // --- render ---
    const handleToggle = (id: number) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const currentCategoryName =
        (selectedCatId && cats.find(c => c.id === selectedCatId)?.name) || null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>Выбор номенклатуры</DialogTitle>
            <DialogContent dividers sx={{ minHeight: 520 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 2 }}>
                    {/* LEFT: Categories tree */}
                    <Box sx={{ borderRight: '1px solid', borderColor: 'divider', pr: 1 }}>
                        <TextField
                            fullWidth size="small" placeholder="Поиск по категории… (необязательно)"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        {loadingCats ? (
                            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={18} /> <Typography>Загрузка категорий…</Typography>
                            </Box>
                        ) : (
                            <List dense sx={{ maxHeight: 420, overflow: 'auto' }}>
                                {tree.map(({ cat, depth, hasChildren }) => {
                                    const isSelected = selectedCatId === cat.id;
                                    return (
                                        <ListItemButton
                                            key={cat.id}
                                            selected={isSelected}
                                            onClick={() => {
                                                if (hasChildren) handleToggle(cat.id);
                                                setSelectedCatId(cat.id);
                                            }}
                                            sx={{ pl: 1 + depth * 2 }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                        {hasChildren && (
                                                            <Box
                                                                component="span"
                                                                sx={{
                                                                    width: 12, height: 12, border: '1px solid',
                                                                    borderColor: 'divider', textAlign: 'center', lineHeight: '12px',
                                                                    fontSize: 10, color: 'text.secondary'
                                                                }}
                                                            >
                                                                {expanded[cat.id] ? '–' : '+'}
                                                            </Box>
                                                        )}
                                                        <span>{cat.name}</span>
                                                    </Box>
                                                }
                                            />
                                        </ListItemButton>
                                    );
                                })}
                                {tree.length === 0 && (
                                    <Box sx={{ p: 2, color: 'text.secondary' }}>Категорий нет</Box>
                                )}
                            </List>
                        )}
                    </Box>

                    {/* RIGHT: Items list */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle2">
                                Позиции {currentCategoryName ? `в «${currentCategoryName}»` : ''}
                            </Typography>
                            <TextField
                                size="small" placeholder="Поиск по номенклатуре…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                sx={{ width: 320 }}
                            />
                        </Box>
                        <Divider sx={{ mb: 1 }} />
                        {loadingItems ? (
                            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={18} /> <Typography>Загрузка позиций…</Typography>
                            </Box>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ width: 80 }}>ID</TableCell>
                                        <TableCell>Наименование</TableCell>
                                        <TableCell sx={{ width: 200 }}>Ед.</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {items.map((it) => (
                                        <TableRow
                                            key={it.id}
                                            hover
                                            selected={selectedItemId === it.id}
                                            onClick={() => setSelectedItemId(it.id)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <TableCell>{it.id}</TableCell>
                                            <TableCell>{it.name}</TableCell>
                                            <TableCell>{it.unit_name || '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3}>
                                                <Typography color="text.secondary">Нет позиций</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button
                    variant="contained"
                    disabled={!selectedItemId}
                    onClick={() => {
                        const item = items.find(i => i.id === selectedItemId);
                        const cat = cats.find(c => c.id === (item?.category ?? selectedCatId ?? 0));
                        onSelect({
                            itemId: selectedItemId!,
                            itemName: item?.name || `#${selectedItemId}`,
                            categoryId: cat?.id ?? (item?.category ?? null),
                            categoryName: cat?.name ?? (item?.category_name ?? null),
                            unitId: item?.unit ?? null,
                            unitName: item?.unit_name ?? null,
                        });
                        onClose();
                    }}
                >
                    Выбрать
                </Button>
            </DialogActions>
        </Dialog>
    );
}
