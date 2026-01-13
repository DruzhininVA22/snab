/**
 * CategoryTreeSelect.tsx
 *
 * Компонент для выбора категорий из иерархического дерева.
 * Поддерживает режимы:
 * - single: выбор одной категории (по умолчанию)
 * - multiple: выбор нескольких категорий с чекбоксами
 *
 * Загружает данные из API и строит древовидную структуру на основе parent_id.
 * ✅ ФИНАЛЬНАЯ ВЕРСИЯ: Верхний уровень НЕ выбирается!
 */

import * as React from 'react';

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    TextField,
    List,
    ListItemButton,
    ListItemText,
    Collapse,
    LinearProgress,
    Typography,
    Divider,
    Checkbox,
} from '@mui/material';

import { ExpandLess, ExpandMore } from '@mui/icons-material';

import { http, fixPath } from '../api/_http';

// ============================================================
// ТИПЫ ДАННЫХ
// ============================================================

/**
 * Тип категории, соответствующий структуре API
 * - id: уникальный идентификатор
 * - code: код категории (H00, H01, S01, S02 и т.д.)
 * - name: название категории
 * - parent_id: ID родительской категории (null если это корневая категория)
 * - includes/excludes/borderline: дополнительные описания
 */
type Cat = {
    id: number;
    code: string;
    name: string;
    parent_id: number | null;
    includes?: string;
    excludes?: string;
    borderline?: string;
};

/**
 * Props компонента CategoryTreeSelect
 * - multiple?: boolean - режим выбора (false = одна, true = несколько)
 * - value: number | null | number[] - выбранное значение
 * - onChange: функция-коллбэк при изменении выбора
 * - label?: string - подпись текстового поля
 */
type CategoryTreeSelectProps = {
    multiple?: boolean;
    value: number | null | number[];
    onChange: (value: number | null | number[]) => void;
    label?: string;
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Разбирает строку excludes на основную часть и примечание о пограничных случаях.
 * Пример: "отделка(H07), инженерия(H06); пограничное: каркас/плиты→изоляции"
 * -> excludes: "отделка(H07), инженерия(H06)"
 * -> notes: "каркас/плиты→изоляции"
 */
function splitExcludes(excludes?: string) {
    const src = (excludes || '').trim();
    if (!src) return { excludes: '', notes: '' };
    const idx = src.toLowerCase().indexOf('пограничное:');
    if (idx === -1) return { excludes: src, notes: '' };
    const before = src.slice(0, idx).trim().replace(/[.;,\s]+$/, '').trim();
    const after = src.slice(idx + 'пограничное:'.length).trim();
    return { excludes: before, notes: after };
}

// ============================================================
// КОМПОНЕНТ: ДЕРЕВО КАТЕГОРИЙ (вспомогательный)
// ============================================================

/**
 * FamiliesTree — отрисовка иерархического дерева категорий.
 * Рекурсивно рендерит узлы и управляет их состоянием (открыт/закрыт).
 *
 * ✅ ВАЖНО: Верхний уровень (корневые категории) НЕ выбирается,
 *          выбираются только листовые элементы (без детей).
 */
function FamiliesTree({
    items,
    openMap,
    onToggle,
    onPick,
    onMultiToggle,
    selectedId,
    selectedIds,
    multiple,
    onHover,
}: {
    items: Cat[];
    openMap: Record<number, boolean>;
    onToggle: (id: number) => void;
    onPick: (id: number) => void;
    onMultiToggle?: (id: number) => void;
    selectedId: number | null;
    selectedIds?: Set<number>;
    multiple?: boolean;
    onHover?: (cat: Cat | null) => void;
}) {
    // ---------- Построение иерархии ----------
    const byId: Record<number, any> = {};
    const roots: any[] = [];

    items.forEach((it) => (byId[it.id] = { ...it, children: [] as any[] }));
    items.forEach((it) => {
        const pid = it.parent_id;
        if (pid && byId[pid]) {
            byId[pid].children.push(byId[it.id]);
        } else {
            roots.push(byId[it.id]);
        }
    });

    // ---------- Сортировка по коду ----------
    const naturalSort = (a: string, b: string) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    const sortRec = (arr: any[]) => {
        arr.sort((a: any, b: any) => naturalSort(a.code || '', b.code || ''));
        arr.forEach((n) => sortRec(n.children));
    };

    sortRec(roots);

    // ---------- Рендер одного узла ----------
    const renderNode = (node: any, depth = 0, isRoot = false): React.ReactNode => {
        const hasChildren = (node.children || []).length > 0;
        const isSelected = multiple ? selectedIds?.has(node.id) : selectedId === node.id;
        const isOpen = !!openMap[node.id];

        // Верхний уровень и узлы с детьми не выбираются (только листовые)
        const isSelectable = !isRoot && !hasChildren;

        const handleClick = () => {
            // Корневой узел — только раскрытие/закрытие
            if (isRoot) {
                onToggle(node.id);
                return;
            }

            if (multiple) {
                if (isSelectable) {
                    onMultiToggle?.(node.id);
                } else if (hasChildren && !isOpen) {
                    onToggle(node.id);
                }
            } else {
                if (hasChildren) {
                    onToggle(node.id);
                } else {
                    onPick(node.id);
                }
            }
        };

        return (
            <React.Fragment key={node.id}>
                <ListItemButton
                    onClick={handleClick}
                    onMouseEnter={() => {
                        if (onHover) onHover(node as Cat);
                    }}
                    onMouseLeave={() => {
                        if (onHover) onHover(null);
                    }}
                    sx={{
                        pl: 2 + depth * 2,
                        py: 0.5,
                        backgroundColor: isRoot ? 'action.hover' : 'transparent',
                        fontWeight: isRoot ? 600 : 400,
                        '&:hover': {
                            backgroundColor: isRoot ? 'action.selected' : 'action.hover',
                        },
                    }}
                    selected={isSelectable && !!isSelected}
                >
                    {/* Иконка раскрытия / пустое место под неё */}
                    {hasChildren ? (
                        <Box
                            sx={{ display: 'flex', alignItems: 'center', mr: 1 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(node.id);
                            }}
                        >
                            {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </Box>
                    ) : (
                        <Box sx={{ width: 24, mr: 1 }} />
                    )}

                    {/* Чекбокс только для листьев в multiple-режиме */}
                    {multiple && isSelectable && (
                        <Checkbox
                            checked={!!isSelected}
                            onChange={(e) => {
                                e.stopPropagation();
                                onMultiToggle?.(node.id);
                            }}
                            size="small"
                            sx={{ mr: 1, ml: -0.5 }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}

                    {/* Текст узла: код + имя */}
                    <ListItemText
                        primary={
                            <Typography variant="body2">
                                {node.code ? `${node.code} ${node.name}` : node.name}
                            </Typography>
                        }
                    />
                </ListItemButton>

                {/* Дети узла */}
                {hasChildren && (
                    <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <List disablePadding>
                            {node.children.map((ch: any) => renderNode(ch, depth + 1, false))}
                        </List>
                    </Collapse>
                )}
            </React.Fragment>
        );
    };

    return <List disablePadding>{roots.map((node) => renderNode(node, 0, true))}</List>;
}

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ: CategoryTreeSelect
// ============================================================

/**
 * CategoryTreeSelect — модальное окно выбора категории/категорий.
 * Слева: дерево, справа: справка по категории.
 */
export default function CategoryTreeSelect(props: CategoryTreeSelectProps) {
    const { value, onChange, multiple = false, label = 'Категория' } = props;

    /** Открыто ли диалоговое окно выбора */
    const [open, setOpen] = React.useState(false);
    /** Флаг загрузки категорий */
    const [loading, setLoading] = React.useState(false);
    /** Список всех категорий */
    const [items, setItems] = React.useState<Cat[]>([]);
    /** Карта раскрытых узлов дерева */
    const [openMap, setOpenMap] = React.useState<Record<number, boolean>>({});
    /** Текущая категория для показа справки (по наведению/клику) */
    const [info, setInfo] = React.useState<Cat | null>(null);

    /** Выбранная категория в single-режиме */
    const [selectedIdSingle, setSelectedIdSingle] = React.useState<number | null>(
        (Array.isArray(value) ? null : value) || null,
    );

    /** Набор выбранных категорий в multiple-режиме */
    const [selectedIdsMultiple, setSelectedIdsMultiple] = React.useState<Set<number>>(
        new Set(Array.isArray(value) ? value : []),
    );

    // ---------- Загрузка данных из API ----------
    React.useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const url = fixPath('/api/catalog/categories/?page_size=2000');
                const { data } = await http.get(url);
                const arr = Array.isArray(data?.results) ? data.results : data;
                const cats: Cat[] = (arr || []).map((c: any) => ({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    parent_id: c.parent_id || null,
                    includes: c.includes,
                    excludes: c.excludes,
                    borderline: c.borderline,
                }));
                setItems(cats);
            } catch (error) {
                console.error('Ошибка загрузки категорий:', error);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ---------- Синхронизация снаружи (value) ----------
    React.useEffect(() => {
        if (multiple) {
            setSelectedIdsMultiple(new Set(Array.isArray(value) ? value : []));
        } else {
            setSelectedIdSingle((Array.isArray(value) ? null : value) || null);
        }
    }, [value, multiple]);

    // ---------- Обработчики диалога ----------
    const handleOpen = () => {
        setOpen(true);

        // В multiple-режиме раскрываем родительские узлы
        if (multiple && items.length > 0) {
            const allIds: Record<number, boolean> = {};
            items.forEach((item) => {
                if (item.parent_id) {
                    allIds[item.parent_id] = true;
                }
            });
            setOpenMap(allIds);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('categoryFilterChange', {
                    detail: {
                        selectedCategories: Array.isArray(value) ? value : value ? [value] : [],
                    },
                }),
            );
        }
    };

    const handleClose = () => {
        setOpen(false);
        setInfo(null);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('categoryFilterChange', {
                    detail: {
                        selectedCategories: Array.isArray(value) ? value : value ? [value] : [],
                    },
                }),
            );
        }
    };

    // ---------- Обработчики дерева ----------
    const handleToggle = (id: number) => {
        setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handlePickSingle = (id: number) => {
        const selected = items.find((it) => it.id === id) || null;
        setSelectedIdSingle(id);
        setInfo(selected);
        onChange(selected ? id : null);
        setOpen(false);
    };

    const handleMultiToggle = (id: number) => {
        setSelectedIdsMultiple((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            onChange(Array.from(next));
            return next;
        });
    };

    /**
     * Обновление справочной панели при наведении на категорию
     */
    const handleItemInfo = (cat: Cat | null) => {
        setInfo(cat);
    };

    // ---------- Текст в поле выбора ----------
    const currentLabel = React.useMemo(() => {
        if (multiple) {
            const selected = items.filter((c) => selectedIdsMultiple.has(c.id));
            const sorted = selected.sort((a, b) =>
                (a.code || '').localeCompare(b.code || '', undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }),
            );
            return sorted.map((c) => `${c.code} ${c.name}`).join('; ') || '';
        } else {
            if (!selectedIdSingle || !items.length) return '';
            const cat = items.find((c) => c.id === selectedIdSingle);
            return cat ? `${cat.code} ${cat.name}` : '';
        }
    }, [selectedIdSingle, selectedIdsMultiple, items, multiple]);

    // ============================================================
    // РЕНДЕР КОМПОНЕНТА
    // ============================================================
    return (
        <>
            {/* Поле, которое открывает диалог выбора категорий */}
            <TextField
                fullWidth
                size="small"
                label={label}
                value={currentLabel}
                onClick={handleOpen}
                InputProps={{
                    readOnly: true,
                }}
            />

            {/* Диалог выбора категорий */}
            <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {multiple ? 'Выбор категорий (несколько)' : 'Выбор категории (одна)'}
                </DialogTitle>
                <DialogContent dividers>
                    {loading && <LinearProgress sx={{ mb: 2 }} />}

                    {!loading && items.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {/* ЛЕВАЯ ЧАСТЬ: дерево категорий */}
                            <Box sx={{ flex: 2, minWidth: 0 }}>
                                <FamiliesTree
                                    items={items}
                                    openMap={openMap}
                                    onToggle={handleToggle}
                                    onPick={handlePickSingle}
                                    onMultiToggle={handleMultiToggle}
                                    selectedId={selectedIdSingle}
                                    selectedIds={selectedIdsMultiple}
                                    multiple={multiple}
                                    onHover={handleItemInfo}
                                />
                            </Box>

                            {/* ПРАВАЯ ЧАСТЬ: 4 поля справки по категории */}
                            <Box sx={{ flex: 3, minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Справка по категории
                                </Typography>
                                <Divider sx={{ mb: 1 }} />

                                {/* Описание */}
                                <Box sx={{ mb: 1.5 }}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{ fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}
                                    >
                                        Описание
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {info ? `${info.code} — ${info.name}` : 'Наведите курсор на категорию'}
                                    </Typography>
                                </Box>

                                {/* Что входит */}
                                <Box sx={{ mb: 1.5 }}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{ fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}
                                    >
                                        Что входит
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {info?.includes || '—'}
                                    </Typography>
                                </Box>

                                {/* Что не входит */}
                                <Box sx={{ mb: 1.5 }}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{ fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}
                                    >
                                        Что не входит
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {info?.excludes ? splitExcludes(info.excludes).excludes : '—'}
                                    </Typography>
                                </Box>

                                {/* Пограничные случаи */}
                                <Box sx={{ mb: 1.5 }}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{ fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}
                                    >
                                        Пограничные случаи
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {info?.borderline ||
                                            (info?.excludes && splitExcludes(info.excludes).notes) ||
                                            '—'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {!loading && items.length === 0 && (
                        <Typography color="text.secondary">Категории не загрузились</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleClose}
                        variant="contained"
                        color="primary"
                        sx={{ fontWeight: 600 }}
                    >
                        ✓ Закрыть
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
