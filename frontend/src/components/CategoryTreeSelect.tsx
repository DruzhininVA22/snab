/**
 * Выбор категории из дерева категорий.
 *
 * Компонент инкапсулирует:
 * - загрузку/представление дерева категорий,
 * - выбор узла и возврат выбранной категории наружу (onChange).
 */
import * as React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Box, TextField, List, ListItemButton, ListItemText, Collapse,
    LinearProgress, Typography, Divider, Chip
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { http, fixPath } from '../api/_http';

type Cat = {
    id: number;
    code: string;
    name: string;
    parent?: { id: number; code: string; name: string } | null;
    includes?: string;
    excludes?: string;
    borderline?: string; // если на бэке уже добавили поле
};

function splitExcludes(excludes?: string) {
    const src = (excludes || '').trim();
    if (!src) return { excludes: '', notes: '' };
    const idx = src.toLowerCase().indexOf('пограничное:');
    if (idx === -1) return { excludes: src, notes: '' };
    const before = src.slice(0, idx).trim().replace(/[.;,\s]+$/, '').trim();
    const after = src.slice(idx + 'пограничное:'.length).trim();
    return { excludes: before, notes: after };
}

function FamiliesTree({
    items, openMap, onToggle, onPick, selectedId,
}: {
    items: Cat[];
    openMap: Record<number, boolean>;
    onToggle: (id: number) => void;
    onPick: (id: number) => void;
    selectedId: number | null;
}) {
    const byId: Record<number, any> = {};
    const roots: any[] = [];
    items.forEach((it) => (byId[it.id] = { ...it, children: [] }));
    items.forEach((it) => {
        const pid = (it as any).parent?.id ?? null;
        if (pid && byId[pid]) byId[pid].children.push(byId[it.id]);
        else roots.push(byId[it.id]);
    });
    const hRoots = roots.filter((n) => String(n.code || '').startsWith('H'));
    const sortRec = (arr: any[]) => {
        arr.sort((a: any, b: any) => (a.code || '').localeCompare(b.code || ''));
        arr.forEach((n) => sortRec(n.children));
    };
    sortRec(hRoots);

    const renderNode = (node: any, depth = 0) => {
        const hasChildren = (node.children || []).length > 0;
        return (
            <React.Fragment key={node.id}>
                <ListItemButton
                    onClick={() => (hasChildren ? onToggle(node.id) : onPick(node.id))}
                    sx={{ pl: 2 + depth * 2 }}
                    selected={selectedId === node.id}
                >
                    {hasChildren ? (openMap[node.id] ? <ExpandLess /> : <ExpandMore />) : <span style={{ width: 24 }} />}
                    <ListItemText primary={`${node.code} — ${node.name}`} />
                </ListItemButton>
                {hasChildren && (
                    <Collapse in={!!openMap[node.id]} timeout="auto" unmountOnExit>
                        <List disablePadding>{node.children.map((ch: any) => renderNode(ch, depth + 1))}</List>
                    </Collapse>
                )}
            </React.Fragment>
        );
    };

    return <List dense>{hRoots.map((n) => renderNode(n))}</List>;
}

export default function CategoryTreeSelect({
    value, onChange, disabled, label,
}: {
    value: number | null;
    onChange: (id: number | null) => void;
    disabled?: boolean;
    label?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [items, setItems] = React.useState<Cat[]>([]);
    const [treeOpen, setTreeOpen] = React.useState<Record<number, boolean>>({});
    const [filter, setFilter] = React.useState('');
    const [picked, setPicked] = React.useState<number | null>(value ?? null);

    const selected = React.useMemo(
        () => items.find((i) => i.id === picked) || null,
        [picked, items],
    );

    const loadAll = React.useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await http.get(fixPath('/api/catalog/categories/'), { params: { page_size: 2000 } });
            const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
            setItems(arr || []);
            const sel = (arr || []).find((x: any) => x.id === picked);
            if (sel && sel.parent?.id) {
                setTreeOpen((prev) => ({ ...prev, [sel.parent.id]: true }));
            }
        } finally {
            setLoading(false);
        }
    }, [picked]);

    React.useEffect(() => {
        if (open) loadAll();
    }, [open, loadAll]);

    const openDialog = () => {
        if (!disabled) setOpen(true);
    };
    const closeDialog = () => setOpen(false);

    const onToggle = (id: number) => setTreeOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    const onPick = (id: number) => {
        const node = items.find((i) => i.id === id);
        if (node && String(node.code || '').startsWith('S')) {
            setPicked(id);
        } else if (node && String(node.code || '').startsWith('H')) {
            onToggle(id);
        }
    };

    const labelValue = React.useMemo(() => {
        const v = items.find((i) => i.id === value) || null;
        return v ? `${v.code} — ${v.name}` : '';
    }, [items, value]);

    const filtered = React.useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) =>
            (`${it.code} ${it.name} ${it.includes || ''} ${it.excludes || ''} ${it.borderline || ''}`)
                .toLowerCase()
                .includes(q),
        );
    }, [items, filter]);

    // показываем «пограничные» из отдельного поля, если есть — иначе берём из excludes по маркеру
    const exclNotes =
        selected?.borderline != null
            ? { excludes: selected?.excludes || '', notes: selected.borderline || '' }
            : splitExcludes(selected?.excludes);

    return (
        <>
            <TextField
                label={label || 'Категория'}
                value={labelValue}
                onClick={openDialog}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
                disabled={disabled}
                placeholder="Выберите категорию…"
            />
            <Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
                <DialogTitle>Выбор категории</DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    {loading && <LinearProgress />}
                    <Box sx={{ display: 'flex', gap: 2, p: 2, minHeight: 420 }}>
                        {/* Лево: дерево + фильтр */}
                        <Box sx={{ width: 420, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 2, mr: 1 }}>
                            <TextField
                                size="small"
                                fullWidth
                                label="Фильтр (код/название/подсказки)"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                sx={{ mb: 1 }}
                            />
                            <FamiliesTree
                                items={filtered}
                                openMap={treeOpen}
                                onToggle={onToggle}
                                onPick={onPick}
                                selectedId={picked}
                            />
                        </Box>

                        {/* Право: рекомендации */}
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                Рекомендации{' '}
                                {selected ? (
                                    <Chip size="small" label={`${selected.code} — ${selected.name}`} sx={{ ml: 1 }} />
                                ) : null}
                            </Typography>

                            {!selected ? (
                                <Typography color="text.secondary">
                                    Выберите раздел (лист Sxx) слева, чтобы увидеть рекомендации.
                                </Typography>
                            ) : (
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.5 }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                            Что должно входить
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {selected.includes || '—'}
                                        </Typography>
                                    </Box>
                                    <Divider />
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                            Что не должно входить
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {exclNotes.excludes || '—'}
                                        </Typography>
                                    </Box>
                                    <Divider />
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                            Пограничные значения
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {exclNotes.notes || '—'}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog}>Отмена</Button>
                    <Button
                        onClick={() => {
                            onChange(picked);
                            closeDialog();
                        }}
                        disabled={!picked}
                        variant="contained"
                    >
                        Выбрать
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
