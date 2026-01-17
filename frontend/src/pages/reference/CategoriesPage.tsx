/**
 * CategoriesTreePage.tsx — ЧИСТАЯ ПРОДАКШЕН ВЕРСИЯ
 * ✅ Без "0" + выделение подпунктов + без отладки
 * ✅ ListItemButton + фильтрация + панель деталей
 */

import * as React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, List, ListItemButton, ListItemText, TextField, Divider } from '@mui/material';
import { http, fixPath } from '../../api/_http';

/**
 * Типы данных для категорий
 */
type Brief = { id: number; code: string; name: string; description?: string };

type Cat = {
  id: number;
  code: string;
  name: string;
  description?: string;
  includes?: string;
  excludes?: string;
  borderline?: string;
  is_leaf?: boolean;
  level?: number;
  path?: string;
  parent?: Brief | null;
  parent_id?: number | null;
  children?: Cat[];
};

/**
 * Строит дерево категорий из плоского массива
 * @param items - плоский массив категорий из API
 * @returns массив корневых узлов
 */
function buildTree(items: Cat[]): Cat[] {
  const byId: Record<number, Cat> = {};
  const roots: Cat[] = [];

  // Создаем узлы по ID
  items.forEach(it => {
    if (it.id) {
      const node = { ...it, children: [] as Cat[] };
      byId[it.id] = node;
    }
  });

  // Связываем детей с родителями (приоритет parent_id > parent.id)
  items.forEach(it => {
    if (!it.id) return;
    const node = byId[it.id];
    const parentId = it.parent_id !== undefined && it.parent_id !== null
      ? it.parent_id
      : (it.parent?.id || null);

    if (parentId && byId[parentId]) {
      byId[parentId].children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // Рекурсивная сортировка по коду
  const sortTree = (nodes: Cat[]) => {
    nodes.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    nodes.forEach(node => node.children?.length && sortTree(node.children));
  };
  sortTree(roots);

  return roots;
}

export default function CategoriesTreePage() {
  // Состояние компонента
  const [flatData, setFlatData] = React.useState<Cat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  const [selected, setSelected] = React.useState<Cat | null>(null);

  // Загрузка данных из API
  React.useEffect(() => {
    setLoading(true);
    http.get(fixPath('/api/catalog/categories/'), { params: { page_size: 3000 } })
      .then((response) => {
        const data = response.data.results || response.data;
        setFlatData(data as Cat[]);
      })
      .catch(err => {
        console.error('Ошибка загрузки категорий:', err);
        alert('Ошибка загрузки категорий: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Мемоизация дерева
  const tree = React.useMemo(() => buildTree(flatData), [flatData]);

  // Переключение состояния раскрытия узла
  const toggle = (id: number) => {
    setOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Проверка соответствия фильтру
  const matches = (node: Cat, q: string): boolean => {
    if (!q.trim()) return true;
    const text = `${node.code} ${node.name} ${node.description || ''} ${node.includes || ''}`;
    return text.toLowerCase().includes(q.toLowerCase());
  };

  // Проверка наличия видимых детей
  const hasVisibleChildren = (node: Cat): boolean => {
    return node.children?.some(child => matches(child, filter)) || false;
  };

  // Обработчик клика по узлу
  const onClickNode = (node: Cat) => {
    setSelected(node);
    // Раскрывать только группы (не листовые категории)
    if (node.children?.length && !node.is_leaf) {
      toggle(node.id);
    }
  };

  /**
   * Рекурсивный рендер узла дерева
   * ✅ Без "0" благодаря nodeElement переменной
   * ✅ Выделение работает для всех уровней
   */
  const renderNode = (node: Cat, depth = 0): React.ReactNode => {
    const hasChildren = node.children?.length && node.children.length > 0;
    const visibleChildren = hasVisibleChildren(node);

    // Скрываем невидимые родительские узлы
    if (!matches(node, filter) && hasChildren && !visibleChildren) {
      return null;
    }

    // ✅ Создаем элемент узла отдельно (без Fragment)
    const nodeElement = (
      <ListItemButton
        onClick={() => onClickNode(node)}
        sx={{
          pl: `${4 + depth * 3}px`, // Отступ для вложенности
          borderLeft: depth > 0 ? `3px solid ${open[node.id] ? '#1976d2' : '#e0e0e0'}` : 'none',
          transition: 'all 0.2s',
          backgroundColor: selected?.id === node.id ? '#f5f5f5' : 'transparent',
          margin: 0,
          padding: '6px 8px',
          minHeight: 'auto',
        }}
        selected={selected?.id === node.id} // ✅ Выделение MUI
      >
        <ListItemText
          primary={`${hasChildren ? (open[node.id] ? '▼' : '▶') : '•'} ${node.code} — ${node.name}`}
          secondary={node.description || undefined} // ✅ Фикс "0"
          primaryTypographyProps={{
            variant: 'body2',
            fontWeight: node.is_leaf ? 400 : 600 // Группы жирнее
          }}
        />
      </ListItemButton>
    );

    // Листовые узлы или закрытые родительские
    if (!hasChildren || !open[node.id]) {
      return nodeElement;
    }

    // ✅ Открытые родительские узлы с детьми (без Fragment)
    return (
      <>
        {nodeElement}
        {node.children!.map((ch) => renderNode(ch, depth + 1))}
      </>
    );
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, p: 2 }}>
      {/* Индикатор загрузки */}
      {loading && <LinearProgress sx={{ gridColumn: '1 / -1' }} />}

      {/* Левая панель — дерево категорий */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Дерево категорий
            <Typography component="span" variant="caption" sx={{ ml: 1, color: '#999' }}>
              ({flatData.length} элементов → {tree.length} групп)
            </Typography>
          </Typography>

          {/* Поиск */}
          <TextField
            placeholder="Поиск по коду, названию, описанию..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ mb: 2 }}
            fullWidth
            size="small"
          />

          {/* Статистика */}
          <Box sx={{ fontSize: 12, color: '#999', mb: 2 }}>
            Группы: {tree.length} | Разделы: {flatData.filter(d => d.is_leaf).length}
          </Box>

          {/* Дерево */}
          <List sx={{
            maxHeight: '70vh',
            overflow: 'auto',
            border: '1px solid #eee',
            borderRadius: 1,
            p: 0
          }}>
            {tree.length === 0 ? (
              <Typography sx={{ p: 2, color: '#999', textAlign: 'center' }}>
                Нет категорий
              </Typography>
            ) : (
              tree.map((n) => renderNode(n, 0))
            )}
          </List>
        </CardContent>
      </Card>

      {/* Правая панель — детали выбранной категории */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {selected ? `(${selected.code}) ${selected.name}` : 'Выберите категорию'}
          </Typography>

          {selected && (
            <>
              <Divider sx={{ my: 2 }} />

              {/* Описание */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📝 Описание
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, color: '#666', lineHeight: 1.5 }}>
                {selected.description || '—'}
              </Typography>

              {/* Входит */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ✅ Входит в категорию
              </Typography>
              <Typography variant="body2" sx={{
                whiteSpace: 'pre-wrap',
                mb: 2,
                color: '#2e7d32',
                fontFamily: 'monospace',
                fontSize: 12,
                backgroundColor: '#e8f5e8',
                p: 1.5,
                borderRadius: 1
              }}>
                {selected.includes || '—'}
              </Typography>

              {/* Не входит */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ❌ НЕ входит в категорию
              </Typography>
              <Typography variant="body2" sx={{
                whiteSpace: 'pre-wrap',
                mb: 2,
                color: '#c62828',
                fontFamily: 'monospace',
                fontSize: 12,
                backgroundColor: '#ffebee',
                p: 1.5,
                borderRadius: 1
              }}>
                {selected.excludes || '—'}
              </Typography>

              {/* Пограничные случаи */}
              {selected.borderline && selected.borderline !== '-' && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    ⚠️ Пограничные случаи
                  </Typography>
                  <Typography variant="body2" sx={{
                    whiteSpace: 'pre-wrap',
                    color: '#ff9800',
                    backgroundColor: '#fff3e0',
                    p: 1.5,
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: 12
                  }}>
                    {selected.borderline}
                  </Typography>
                </>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Метаданные */}
              <Typography variant="caption" sx={{ color: '#999', display: 'block' }}>
                ID: {selected.id} | Уровень: {selected.level} |
                Лист: {selected.is_leaf ? '✅' : '❌'} |
                Путь: {selected.path || '—'}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
