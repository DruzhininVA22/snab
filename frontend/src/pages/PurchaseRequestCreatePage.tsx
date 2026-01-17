/**
 * Создание заявки на закупку (PR).
 *
 * Страница формирует черновик заявки и отправляет его в backend.
 * Как правило, включает выбор проекта/этапа и добавление строк (материалы/кол-во/ед.изм).
 */
import * as React from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress, Button, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Stack,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AddIcon from '@mui/icons-material/Add';
import { http, fixPath } from '../api/_http';
import ProjectSelect from '../components/ProjectSelect';
import ProjectStageSelect from '../components/ProjectStageSelect';
import CatalogPickDialog, { CatalogPickResult } from '../components/CatalogPickDialog';

type UnitRef = { id: number; name: string; code?: string };
type Line = {
  item: number | null;
  itemName?: string;
  categoryName?: string;
  unit?: number | null;
  unitName?: string;
  qty: number;
  note?: string;
};

function useQueryPrefill() {
  const [prefill, setPrefill] = React.useState<{ project?: number; stage?: number }>({});
  React.useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const pr = p.get('project'); const st = p.get('stage');
      setPrefill({
        project: pr ? Number(pr) : undefined,
        stage: st ? Number(st) : undefined,
      });
    } catch { }
  }, []);
  return prefill;
}

export default function PurchaseRequestCreatePage() {
  // компактнее поля и шрифт, как на просмотре
  const pageSx = {
    px: 1, mx: -1,
    fontSize: '0.875rem',
    lineHeight: 1.35,
    '& .MuiTypography-root': { fontSize: '0.875rem' },
    '& .MuiButton-root, & .MuiInputBase-root, & .MuiSelect-select, & .MuiMenuItem-root': { fontSize: '0.875rem' },
    '& .MuiTableCell-root': { fontSize: '0.8125rem' },
    '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
  } as const;

  const [loading, setLoading] = React.useState(false);
  const [comment, setComment] = React.useState('');
  const prefill = useQueryPrefill();
  const [projectId, setProjectId] = React.useState<number | null>(prefill.project ?? null);
  const [stageId, setStageId] = React.useState<number | null>(prefill.stage ?? null);

  const [units, setUnits] = React.useState<UnitRef[]>([]);
  const [lines, setLines] = React.useState<Line[]>([{ item: null, qty: 1 }]);
  const [saving, setSaving] = React.useState(false);

  // диалог выбора
  const [pickIdx, setPickIdx] = React.useState<number | null>(null);

  const addLine = () => setLines(prev => [...prev, { item: null, qty: 1 }]);
  const canSave = !!projectId && !!stageId && lines.some(l => l.item != null && l.qty > 0);

  React.useEffect(() => {
    // подгрузка единиц
    (async () => {
      const tryUrls = [
        fixPath('/api/core/units/?page_size=1000'),
        fixPath('/api/catalog/units/?page_size=1000'),
        fixPath('/api/units/?page_size=1000'),
      ];
      for (const url of tryUrls) {
        try {
          const { data } = await http.get(url);
          const raw = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
          if (raw.length) {
            setUnits(raw.map((u: any) => ({ id: u.id, name: u.name || u.title || u.code || `#${u.id}`, code: u.code })));
            return;
          }
        } catch { }
      }
    })();
  }, []);

  const onPick = (idx: number, res: CatalogPickResult) => {
    setPickIdx(null);
    setLines(prev => prev.map((r, i) => i === idx ? ({
      ...r,
      item: res.itemId,
      itemName: res.itemName,
      categoryName: res.categoryName || r.categoryName,
      unit: (res.unitId ?? r.unit) ?? null,
      unitName: res.unitName ?? r.unitName,
    }) : r));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: any = {
        comment: comment,
        project_stage_id: stageId,
        lines: lines
          .filter(l => l.item !== null && l.qty > 0)
          .map(l => ({
            item: l.item,
            qty: l.qty,
            unit: l.unit ?? undefined,
            comment: l.note,
          })),
      };

      // console.log('Sending payload:', payload);
      const res = await http.post(fixPath('/api/procurement/purchase-requests/'), payload);
      // console.log('Response:', res.data);

      window.location.href = '/pr';
    } catch {
      alert('Не удалось создать заявку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={pageSx}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Новая заявка</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={save} variant="contained" disabled={!canSave || saving}>Сохранить</Button>
            </Stack>
          </Stack>

          {/* Проект и Этап */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <ProjectSelect value={projectId} onChange={setProjectId} />
            <ProjectStageSelect projectId={projectId} value={stageId} onChange={setStageId} />
          </Stack>

          {/* Описание заявки */}
          <TextField
            label="Комментарий (описание заявки)"
            size="small"
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">Строки</Typography>
            <Button startIcon={<AddIcon />} onClick={addLine}>Добавить строку</Button>
          </Stack>

          <Table size="small" aria-label="lines">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 28 }} align="right">№</TableCell>
                <TableCell sx={{ width: 220 }}>Категория</TableCell>
                <TableCell>Наименование</TableCell>
                <TableCell sx={{ width: 56 }} align="center">…</TableCell>
                <TableCell sx={{ width: 140 }}>Ед.</TableCell>
                <TableCell sx={{ width: 100 }} align="right">Кол-во</TableCell>
                <TableCell sx={{ width: 260 }}>Комментарий</TableCell>
                <TableCell sx={{ width: 56 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell align="right">{idx + 1}</TableCell>

                  {/* Категория (RO) */}
                  <TableCell>{row.categoryName || '—'}</TableCell>

                  {/* Наименование (RO) */}
                  <TableCell>{row.itemName || (row.item ? `#${row.item}` : '—')}</TableCell>

                  {/* Кнопка выбора номенклатуры */}
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => setPickIdx(idx)} aria-label="Выбрать номенклатуру">
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                  </TableCell>

                  {/* Единица измерения */}
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <InputLabel id={`unit-${idx}`}>Ед.</InputLabel>
                      <Select
                        labelId={`unit-${idx}`} label="Ед."
                        value={row.unit ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          const u = units.find(u => u.id === val || u.id === Number(val));
                          setLines(prev => prev.map((r, i) => i === idx ? { ...r, unit: val, unitName: u?.name } : r));
                        }}
                      >
                        <MenuItem value=""><em>—</em></MenuItem>
                        {units.map(u => (
                          <MenuItem key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>

                  {/* Количество */}
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ min: 0, step: '0.01' }}
                      value={row.qty}
                      onChange={(e) => setLines(prev => prev.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) } : r))}
                    />
                  </TableCell>

                  {/* Комментарий */}
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.note ?? ''}
                      onChange={(e) => setLines(prev => prev.map((r, i) => i === idx ? { ...r, note: e.target.value } : r))}
                    />
                  </TableCell>

                  {/* Удалить */}
                  <TableCell>
                    <IconButton onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))} size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Диалог выбора каталога (категории слева, товары справа) */}
          <CatalogPickDialog
            open={pickIdx !== null}
            onClose={() => setPickIdx(null)}
            onSelect={(res) => { if (pickIdx !== null) onPick(pickIdx, res); }}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
