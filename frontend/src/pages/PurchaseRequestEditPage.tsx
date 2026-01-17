/**
 * Редактирование заявки на закупку (Purchase Request).
 * 
 * Позволяет изменить проект, этап, комментарий, дедлайн и строки заявки.
 * Заблокировано для заявок в статусе closed/done/approved/cancelled.
 */
import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AddIcon from '@mui/icons-material/Add';
import { useParams, useNavigate } from 'react-router-dom';
import { http, fixPath } from '../api/_http';
import ProjectSelect from '../components/ProjectSelect';
import ProjectStageSelect from '../components/ProjectStageSelect';
import CatalogPickDialog, { CatalogPickResult } from '../components/CatalogPickDialog';

type UnitRef = {
  id: number;
  name: string;
  code?: string;
};

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

/** Извлечь числовой ID из разных форматов */
function pickId(src: any): number | null {
  if (src === null) return null;
  if (typeof src === 'number') return src;
  if (typeof src === 'string') {
    const n = Number(src);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof src === 'object') {
    if ('id' in src && typeof (src as any).id !== 'undefined') {
      const n = Number((src as any).id);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export default function PurchaseRequestEditPage() {
  const pageSx = {
    px: 1,
    mx: -1,
    fontSize: '0.875rem',
    lineHeight: 1.35,
    '& .MuiTypography-root': { fontSize: '0.875rem' },
    '& .MuiButton-root, .MuiInputBase-root, .MuiSelect-select, .MuiMenuItem-root': {
      fontSize: '0.875rem',
    },
    '& .MuiTableCell-root': { fontSize: '0.8125rem' },
    '& .MuiTypography-h6': { fontSize: '1rem', fontWeight: 600 },
  } as const;

  const { id } = useParams();
  const nav = useNavigate();

  // Состояние заявки
  const [loading, setLoading] = React.useState(false);
  const [comment, setComment] = React.useState('');
  const [deadline, setDeadline] = React.useState<string>('');
  const [projectId, setProjectId] = React.useState<number | null>(null);
  const [stageId, setStageId] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<string>('');
  const [lines, setLines] = React.useState<Line[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Справочники
  const [units, setUnits] = React.useState<UnitRef[]>([]);
  const [pickIdx, setPickIdx] = React.useState<number | null>(null);

  // Загрузка заявки
  React.useEffect(() => {
    setLoading(true);
    http
      .get(fixPath(`api/procurement/purchase-requests/${id}/`))
      .then((response) => {
        const data = response.data;

        console.log('=== LOADED PR DATA ===', data);

        setComment(data.comment || '');
        setDeadline(data.deadline || '');
        setStatus(data.status || '');

        // Извлекаем проект и этап
        const prId = pickId(
          data.project ??
          data.project_id ??
          data.project_display
        );
        const stId = pickId(
          data.stage ??
          data.stage_id ??
          data.stage_display ??
          data.project_stage ??
          data.project_stage_id ??
          data.project_stage_display
        );

        console.log('Extracted prId:', prId, 'stId:', stId);

        setProjectId(prId);
        setStageId(stId);
        setStatus(data.status || '');

        // Загружаем строки
        const rows = (data.lines || []).map((l: any) => ({
          id: l.id,
          item: l.item ?? null,
          itemName: l.item_name || (l.item ? l.item : undefined),
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

  // Загрузка единиц измерения
  React.useEffect(() => {
    const loadUnits = async () => {
      const tryUrls = [
        fixPath('api/units?pagesize1000'),
        fixPath('api/core/units?pagesize1000'),
        fixPath('api/catalog/units?pagesize1000'),
      ];

      for (const url of tryUrls) {
        try {
          const response = await http.get(url);
          const data = response.data;
          const raw = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : data;

          if (raw && raw.length) {
            setUnits(
              raw.map((u: any) => ({
                id: u.id,
                name: u.name || u.title || u.code || String(u.id),
                code: u.code,
              }))
            );
            return;
          }
        } catch {
          // пробуем следующий URL
        }
      }
    };

    loadUnits();
  }, []);

  // Можно ли редактировать (закрытые заявки редактировать нельзя)
  const canEdit = !['closed', 'done', 'approved', 'cancelled'].includes(
    status.toLowerCase()
  );
  const canSave =
    canEdit &&
    !!projectId &&
    !!stageId &&
    lines.some((l) => l.item !== null && l.qty > 0);

  // Выбор товара из каталога
  const onPick = (idx: number, res: CatalogPickResult) => {
    setPickIdx(null);
    setLines((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
            ...r,
            item: res.itemId,
            itemName: res.itemName,
            categoryName: res.categoryName || r.categoryName,
            unit: res.unitId ?? r.unit ?? null,
            unitName: res.unitName ?? r.unitName,
          }
          : r
      )
    );
  };

  // Добавить пустую строку
  const addLine = () => {
    setLines((prev) => [...prev, { item: null, qty: 1 }]);
  };

  // Сохранение
  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        comment,
        project_stage_id: stageId,
        deadline: deadline || null,
        lines: lines
          .filter((l) => l.item !== null && l.qty > 0)
          .map((l) => {
            const base: any = {
              id: l.id,
              item: l.item,
              qty: l.qty,
              note: l.note,
            };
            if (l.unit) base.unit = l.unit;
            return base;
          }),
      };

      const res = await http.patch(
        fixPath(`api/procurement/purchase-requests/${id}/`),
        payload
      );

      console.log('=== EDIT: SUCCESS ===', res.data);
      nav('/pr');
    } catch (e: any) {
      console.error('Edit save error:', e);
      alert('Ошибка: ' + (e?.response?.data || e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={pageSx}>
      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          {/* Заголовок */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Редактирование заявки #{id}</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                onClick={save}
                variant="contained"
                disabled={!canSave || saving}
              >
                Сохранить
              </Button>
            </Stack>
          </Stack>

          {/* Информация о проекте и этапе */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: '#f9f9f9' }}>
            <Stack direction="row" spacing={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Проект
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {projectId ? `#${projectId}` : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Этап
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {stageId ? `#${stageId}` : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Статус
                </Typography>
                <Typography variant="body1">{status || '—'}</Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Форма редактирования */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <ProjectSelect
              value={projectId}
              onChange={setProjectId}
              disabled={!canEdit}
            />
            <ProjectStageSelect
              projectId={projectId}
              value={stageId}
              onChange={setStageId}
              disabled={!canEdit}
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Комментарий"
              size="small"
              fullWidth
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={!canEdit}
            />
            <TextField
              label="Дедлайн"
              type="date"
              size="small"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              sx={{ minWidth: 200 }}
              disabled={!canEdit}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          {/* Строки заявки */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle1">Позиции</Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addLine}
              disabled={!canEdit}
            >
              Добавить
            </Button>
          </Stack>

          <Table size="small" aria-label="lines">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 28 }} align="right">
                  №
                </TableCell>
                <TableCell sx={{ width: 220 }}>Категория</TableCell>
                <TableCell>Номенклатура</TableCell>
                <TableCell sx={{ width: 56 }} align="center">
                  ☰
                </TableCell>
                <TableCell sx={{ width: 140 }}>Ед.изм</TableCell>
                <TableCell sx={{ width: 100 }} align="right">
                  Кол-во
                </TableCell>
                <TableCell sx={{ width: 260 }}>Примечание</TableCell>
                <TableCell sx={{ width: 56 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((row, idx) => (
                <TableRow key={row.id ?? idx}>
                  {/* № */}
                  <TableCell align="right">{idx + 1}</TableCell>

                  {/* RO Категория */}
                  <TableCell>{row.categoryName || '—'}</TableCell>

                  {/* RO Номенклатура */}
                  <TableCell>
                    {row.itemName || (row.item ? row.item : '—')}
                  </TableCell>

                  {/* Кнопка выбора товара */}
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => setPickIdx(idx)}
                      aria-label="Выбрать товар"
                      disabled={!canEdit}
                    >
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                  </TableCell>

                  {/* Единица измерения */}
                  <TableCell>
                    <FormControl size="small" fullWidth disabled={!canEdit}>
                      <InputLabel id={`unit-${idx}`}>Ед.изм</InputLabel>
                      <Select
                        labelId={`unit-${idx}`}
                        label="Ед.изм"
                        value={row.unit ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          const u = units.find((u) => u.id === Number(val));
                          setLines((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, unit: val, unitName: u?.name }
                                : r
                            )
                          );
                        }}
                      >
                        <MenuItem value="">—</MenuItem>
                        {units.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            {u.name}
                            {u.code ? ` (${u.code})` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>

                  {/* Количество */}
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ min: 0, step: 0.01 }}
                      value={row.qty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, qty: Number(e.target.value) } : r
                          )
                        )
                      }
                      disabled={!canEdit}
                    />
                  </TableCell>

                  {/* Примечание */}
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.note ?? ''}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, note: e.target.value } : r
                          )
                        )
                      }
                      disabled={!canEdit}
                    />
                  </TableCell>

                  {/* Удалить */}
                  <TableCell>
                    <IconButton
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== idx))
                      }
                      size="small"
                      disabled={!canEdit}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог выбора товара */}
      <CatalogPickDialog
        open={pickIdx !== null}
        onClose={() => setPickIdx(null)}
        onSelect={(res) => {
          if (pickIdx !== null) onPick(pickIdx, res);
        }}
      />
    </Box>
  );
}

