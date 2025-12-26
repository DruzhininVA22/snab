/**
 * Редактирование заявки на закупку (PR).
 *
 * Позволяет:
 * - править шапку заявки (проект/этап/комментарии),
 * - редактировать строки (позиции материалов),
 * - отслеживать статус обработки.
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
import { useParams, useNavigate } from 'react-router-dom';
import { http, fixPath } from '../api/_http';
import ProjectSelect from '../components/ProjectSelect';
import ProjectStageSelect from '../components/ProjectStageSelect';
import CatalogPickDialog, { CatalogPickResult } from '../components/CatalogPickDialog';

type UnitRef = { id: number; name: string; code?: string };
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
type PR = any;

function pickId(src: any): number | null {
  if (src == null) return null;
  if (typeof src === 'number') return src;
  if (typeof src === 'string') { const n = Number(src); return Number.isFinite(n) ? n : null; }
  if (typeof src === 'object') {
    if ('id' in src && typeof src.id !== 'undefined') {
      const n = Number((src as any).id);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export default function PurchaseRequestEditPage() {
  const pageSx = {
    px: 1, mx: -1,
    fontSize: '0.875rem',
    lineHeight: 1.35,
    '& .MuiTypography-root': { fontSize: '0.875rem' },
    '& .MuiButton-root, & .MuiInputBase-root, & .MuiSelect-select, & .MuiMenuItem-root': { fontSize: '0.875rem' },
    '& .MuiTableCell-root': { fontSize: '0.8125rem' },
    '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
  } as const;

  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [comment, setComment] = React.useState('');
  const [projectId, setProjectId] = React.useState<number | null>(null);
  const [stageId, setStageId] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<string>('');
  const [lines, setLines] = React.useState<Line[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [units, setUnits] = React.useState<UnitRef[]>([]);
  const [pickIdx, setPickIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    setLoading(true);
    http.get(fixPath(`/api/procurement/purchase-requests/${id}/`))
      .then(({ data }) => {
        setComment(data.comment || '');
        const prId = pickId(data.project) ?? pickId(data.project_id) ?? pickId(data.project_display);
        const stId = pickId(data.stage) ?? pickId(data.stage_id) ?? pickId(data.stage_display) ?? pickId(data.project_stage) ?? pickId(data.project_stage_id) ?? pickId(data.project_stage_display);
        setProjectId(prId);
        setStageId(stId);
        setStatus(data.status || '');

        const rows = (data.lines || []).map((l: any) => ({
          id: l.id,
          item: l.item ?? null,
          itemName: l.item_name || (l.item ? `#${l.item}` : undefined),
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

  React.useEffect(() => {
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

  const canEdit = !['closed', 'done', 'approved', 'cancelled'].includes((status || '').toLowerCase());
  const canSave = canEdit && !!projectId && !!stageId && lines.some(l => l.item != null && l.qty > 0);

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

  const addLine = () => setLines(prev => [...prev, { item: null, qty: 1 }]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: any = {
        comment,
        project: projectId,
        stage: stageId,
        project_stage: stageId,
        lines: lines
          .filter(l => l.item != null && l.qty > 0)
          .map(l => {
            const base: any = { id: l.id, item: l.item, qty: l.qty, note: l.note || '' };
            if (l.unit) base.unit = l.unit;
            return base;
          }),
      };
      await http.patch(fixPath(`/api/procurement/purchase-requests/${id}/`), payload);
      nav('/pr');
    } catch {
      alert('Не удалось сохранить заявку');
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
            <Typography variant="h6">Заявка №{id}</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={save} variant="contained" disabled={!canSave || saving || !canEdit}>Сохранить</Button>
            </Stack>
          </Stack>

          {/* Проект и Этап */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <ProjectSelect value={projectId} onChange={setProjectId} disabled={!canEdit} />
            <ProjectStageSelect projectId={projectId} value={stageId} onChange={setStageId} disabled={!canEdit} />
          </Stack>

          {/* Описание заявки */}
          <TextField
            label="Комментарий (описание заявки)"
            size="small"
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{ mb: 2 }}
            disabled={!canEdit}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">Строки</Typography>
            <Button startIcon={<AddIcon />} onClick={addLine} disabled={!canEdit}>Добавить строку</Button>
          </Stack>

          <Table size="small">
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
                <TableRow key={row.id ?? idx}>
                  <TableCell align="right">{idx + 1}</TableCell>

                  {/* Категория (RO) */}
                  <TableCell>{row.categoryName || '—'}</TableCell>

                  {/* Наименование (RO) */}
                  <TableCell>{row.itemName || (row.item ? `#${row.item}` : '—')}</TableCell>

                  {/* Кнопка выбора номенклатуры */}
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => canEdit && setPickIdx(idx)} aria-label="Выбрать номенклатуру" disabled={!canEdit}>
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                  </TableCell>

                  {/* Единица измерения */}
                  <TableCell>
                    <FormControl size="small" fullWidth disabled={!canEdit}>
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
                      disabled={!canEdit}
                    />
                  </TableCell>

                  {/* Комментарий */}
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.note ?? ''}
                      onChange={(e) => setLines(prev => prev.map((r, i) => i === idx ? { ...r, note: e.target.value } : r))}
                      disabled={!canEdit}
                    />
                  </TableCell>

                  {/* Удалить */}
                  <TableCell>
                    <IconButton onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))} size="small" disabled={!canEdit}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Диалог выбора каталога */}
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
