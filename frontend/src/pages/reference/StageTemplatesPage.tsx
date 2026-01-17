/**
 * Управление шаблонами этапов проектов.
 * CRUD для StageTemplate с редактированием этапов и сохранением как новый шаблон.
 */

import * as React from 'react';

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Divider,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http, fixPath } from '../../api/_http';

type StageTemplateLine = {
  id: number;
  template: number;
  order?: number | null;
  name: string;
};

type StageTemplate = {
  id: number;
  name: string;
  description?: string | null;
  is_system?: boolean;
  lines?: StageTemplateLine[];
};

export default function StageTemplatesPage() {
  const qc = useQueryClient();

  // ========== ОСНОВНОЙ СПИСОК ==========

  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [formName, setFormName] = React.useState('');
  const [formDesc, setFormDesc] = React.useState('');

  const { data: templates = [], isLoading } = useQuery<StageTemplate[]>({
    queryKey: ['stage-templates'],
    queryFn: async () => {
      const response = await http.get(fixPath('/api/projects/templates/'));
      const data = response.data;
      console.log('Templates response:', data);
      return Array.isArray(data) ? data : data?.results || [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      if (editId) {
        return await http.patch(
          fixPath(`/api/projects/templates/${editId}/`),
          payload,
        );
      } else {
        return await http.post(fixPath('/api/projects/templates/'), payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage-templates'] });
      setDlgOpen(false);
      setFormName('');
      setFormDesc('');
      setEditId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      http.delete(fixPath(`/api/projects/templates/${id}/`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage-templates'] });
      setDetailOpen(false);
      setSelectedTemplateId(null);
    },
  });

  const handleAdd = () => {
    setEditId(null);
    setFormName('');
    setFormDesc('');
    setDlgOpen(true);
  };

  const handleEdit = (tpl: StageTemplate) => {
    setEditId(tpl.id);
    setFormName(tpl.name);
    setFormDesc(tpl.description || '');
    setDlgOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;
    saveMut.mutate({ name: formName, description: formDesc });
  };

  // ========== ПРОСМОТР И РЕДАКТИРОВАНИЕ ДЕТАЛЕЙ ШАБЛОНА ==========

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<number | null>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const { data: templateLines = [] } = useQuery<StageTemplateLine[]>({
    queryKey: ['template-lines', selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return [];
      const res = await http.get(
        fixPath('/api/projects/template-lines/'),
        { params: { template: selectedTemplateId } }
      );
      const data = res.data;
      return Array.isArray(data) ? data : data?.results || [];
    },
    enabled: !!selectedTemplateId,
  });

  // Вместо локального стейта и useEffect — вычисляемое значение
  const localLines = React.useMemo(() => templateLines || [], [templateLines]);

  // ========== CRUD ДЛЯ ЛИНИЙ ШАБЛОНА ==========

  const createLineMut = useMutation({
    mutationFn: async (payload: { template: number; name: string; order?: number }) => {
      const res = await http.post(fixPath('/api/projects/template-lines/'), payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-lines', selectedTemplateId] });
    },
  });

  const updateLineMut = useMutation({
    mutationFn: async (payload: { id: number; name?: string; order?: number | null }) => {
      const res = await http.patch(
        fixPath(`/api/projects/template-lines/${payload.id}/`),
        { name: payload.name, order: payload.order },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-lines', selectedTemplateId] });
    },
  });

  const deleteLineMut = useMutation({
    mutationFn: (id: number) =>
      http.delete(fixPath(`/api/projects/template-lines/${id}/`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-lines', selectedTemplateId] });
    },
  });

  const [newLineName, setNewLineName] = React.useState('');

  const addLine = () => {
    if (!newLineName.trim() || !selectedTemplateId) return;
    const nextOrder =
      (localLines.length ? Math.max(...localLines.map((l) => l.order || 0)) : 0) + 1;

    createLineMut.mutate({
      template: selectedTemplateId,
      name: newLineName,
      order: nextOrder,
    });

    setNewLineName('');
  };

  const updateLine = (id: number, name: string, order: number | null) => {
    updateLineMut.mutate({ id, name, order });
  };

  const deleteLine = (id: number) => {
    deleteLineMut.mutate(id);
  };

  const moveLine = (idx: number, dir: -1 | 1) => {
    // Пересчитываем порядок и отправляем только обновлённые order в API
    const arr = [...localLines];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;

    const tmp = arr[idx];
    arr[idx] = arr[j];
    arr[j] = tmp;

    arr.forEach((line, index) => {
      const newOrder = index + 1;
      if (line.order !== newOrder) {
        updateLine(line.id, line.name, newOrder);
      }
    });
  };

  // ========== СОХРАНЕНИЕ КАК НОВЫЙ ШАБЛОН ==========

  const [saveAsNewOpen, setSaveAsNewOpen] = React.useState(false);
  const [newTplName, setNewTplName] = React.useState('');
  const [newTplDesc, setNewTplDesc] = React.useState('');

  const saveAsNewMut = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId || !newTplName.trim()) return;

      const createRes = await http.post(fixPath('/api/projects/templates/'), {
        name: newTplName,
        description: newTplDesc,
        is_system: false,
      });

      const newTemplateId = createRes.data.id;

      for (const line of localLines) {
        await http.post(fixPath('/api/projects/template-lines/'), {
          template: newTemplateId,
          name: line.name,
          order: line.order,
        });
      }

      return createRes.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage-templates'] });
      setSaveAsNewOpen(false);
      setNewTplName('');
      setNewTplDesc('');
      setDetailOpen(false);
      setSelectedTemplateId(null);
    },
  });

  const openDetailPage = (tpl: StageTemplate) => {
    setSelectedTemplateId(tpl.id);
    setDetailOpen(true);
  };

  // ========== РЕНДЕР ==========

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Шаблоны этапов
      </Typography>

      {/* ========== ОСНОВНОЙ СПИСОК ==========*/}
      <Stack direction="row" sx={{ mb: 2 }} spacing={2}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Добавить шаблон
        </Button>
      </Stack>

      {isLoading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>ID</TableCell>
                <TableCell>Название</TableCell>
                <TableCell>Описание</TableCell>
                <TableCell align="center">Этапов</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell>{tpl.id}</TableCell>
                  <TableCell>{tpl.name}</TableCell>
                  <TableCell>{tpl.description}</TableCell>
                  <TableCell align="center">{tpl.lines?.length || 0}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="info"
                      onClick={() => openDetailPage(tpl)}
                      title="Редактировать этапы"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteMut.mutate(tpl.id)}
                      title="Удалить шаблон"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ========== ДИАЛОГ РЕДАКТИРОВАНИЯ ШАБЛОНА (МЕТАДАННЫЕ) ==========*/}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Название"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Описание"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)}>Отмена</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saveMut.isPending || !formName.trim()}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========== ДИАЛОГ РЕДАКТИРОВАНИЯ ЭТАПОВ ШАБЛОНА ==========*/}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Редактирование этапов: {selectedTemplate?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* Метаданные шаблона */}
          {selectedTemplate && (
            <Card sx={{ mb: 3 }}>
              <CardHeader title="Сведения о шаблоне" />
              <CardContent>
                <Stack spacing={1}>
                  <Typography>
                    <strong>Название:</strong> {selectedTemplate.name}
                  </Typography>
                  <Typography>
                    <strong>Описание:</strong>{' '}
                    {selectedTemplate.description || '(не указано)'}
                  </Typography>
                  <Typography>
                    <strong>Системный:</strong>{' '}
                    {selectedTemplate.is_system ? 'Да' : 'Нет'}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ mb: 2 }}>
            Этапы
          </Typography>

          {localLines.length === 0 ? (
            <Alert severity="info">Нет этапов в этом шаблоне</Alert>
          ) : (
            <Stack spacing={2} sx={{ mb: 3 }}>
              {localLines.map((line, idx) => (
                <Paper key={line.id} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    <TextField
                      label="Название этапа"
                      value={line.name}
                      onChange={(e) =>
                        updateLine(line.id, e.target.value, line.order ?? null)
                      }
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Порядок"
                      type="number"
                      value={line.order ?? ''}
                      onChange={(e) =>
                        updateLine(
                          line.id,
                          line.name,
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      size="small"
                      sx={{ width: 100 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => moveLine(idx, -1)}
                      disabled={idx === 0}
                      title="Переместить выше"
                    >
                      <ArrowUpwardIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => moveLine(idx, 1)}
                      disabled={idx === localLines.length - 1}
                      title="Переместить ниже"
                    >
                      <ArrowDownwardIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() =>
                        updateLine(line.id, line.name, line.order ?? null)
                      }
                      color="primary"
                      title="Сохранить изменения"
                    >
                      <SaveIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => deleteLine(line.id)}
                      color="error"
                      title="Удалить этап"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}

          {/* Добавление нового этапа */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Добавить новый этап
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Название нового этапа"
              value={newLineName}
              onChange={(e) => setNewLineName(e.target.value)}
              size="small"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={addLine}
              disabled={!newLineName.trim() || createLineMut.isPending}
            >
              Добавить
            </Button>
          </Stack>

          {/* Ошибки */}
          {updateLineMut.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Ошибка при обновлении этапа
            </Alert>
          )}
          {deleteLineMut.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Ошибка при удалении этапа
            </Alert>
          )}
          {createLineMut.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Ошибка при добавлении этапа
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Закрыть</Button>
          <Button
            variant="contained"
            onClick={() => setSaveAsNewOpen(true)}
            disabled={localLines.length === 0}
          >
            Сохранить как новый шаблон
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========== ДИАЛОГ СОХРАНЕНИЯ КАК НОВЫЙ ШАБЛОН ==========*/}
      <Dialog
        open={saveAsNewOpen}
        onClose={() => setSaveAsNewOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Сохранить как новый шаблон</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Название нового шаблона"
            value={newTplName}
            onChange={(e) => setNewTplName(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Описание нового шаблона"
            value={newTplDesc}
            onChange={(e) => setNewTplDesc(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Typography
            variant="caption"
            sx={{ mt: 2, display: 'block', color: 'gray' }}
          >
            Будут скопированы все {localLines.length} этап(ов) текущего шаблона.
          </Typography>
          {saveAsNewMut.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Ошибка при сохранении шаблона
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveAsNewOpen(false)}>Отмена</Button>
          <Button
            onClick={() => saveAsNewMut.mutate()}
            variant="contained"
            disabled={saveAsNewMut.isPending || !newTplName.trim()}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
