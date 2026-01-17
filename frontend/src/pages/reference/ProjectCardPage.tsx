/**
 * Карточка проекта.
 *
 * Позволяет просматривать основные атрибуты проекта и связанные этапы.
 * Дополнительно может использоваться как точка входа для управления этапами.
 */
import * as React from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  Divider,
  Alert,
  IconButton,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchProject,
  fetchProjectStages,
  updateProject,
  createStageWithFallback,
  applyTemplateToProject,
  fetchStageTemplates,
  saveProjectStagesAsTemplate,
  type Project,
  type ProjectStage,
  type StageTemplate,
} from '../../api/projects';
import { updateStage, deleteStage, reorderProjectStages } from '../../api/projects.extra';

export default function ProjectCardPage() {
  const params = useParams();
  const idParam = params?.id || params?.projectId || '';
  const projectId = Number(idParam);
  const qc = useQueryClient();

  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });

  const { data: stages = [] } = useQuery<ProjectStage[]>({
    queryKey: ['project-stages', projectId],
    queryFn: () => fetchProjectStages(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });

  // ---------- локальное состояние для новых этапов ----------
  const [newName, setNewName] = React.useState('Новый этап');
  const nextOrder = React.useMemo(() => {
    const orders = (stages || []).map((s) => s.order || 0);
    return (orders.length ? Math.max(...orders) : 0) + 1;
  }, [stages]);
  const [newOrder, setNewOrder] = React.useState<number>(nextOrder);
  React.useEffect(() => setNewOrder(nextOrder), [nextOrder]);

  // ---------- CRUD по этапам ----------
  const createMut = useMutation({
    mutationFn: (payload: { name: string; order?: number | null }) =>
      createStageWithFallback(projectId, payload),
    onSuccess: (data: any) => {
      const newStages = Array.isArray(data) ? data : data?.stages;
      qc.setQueryData(['project-stages', projectId], newStages || stages);
      setNewName('');
      setNewOrder((o) => (o || 0) + 1);
    },
  });

  const saveMut = useMutation({
    mutationFn: (payload: { id: number; name?: string; order?: number | null }) =>
      updateStage(payload.id, { name: payload.name, order: payload.order }),
    onSuccess: (data: any) => {
      const newStages = Array.isArray(data) ? data : data?.stages;
      qc.setQueryData(['project-stages', projectId], newStages || stages);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteStage(id),
    onSuccess: (data: any) => {
      const newStages = Array.isArray(data) ? data : data?.stages;
      qc.setQueryData(['project-stages', projectId], newStages || stages);
    },
  });

  const reorderMut = useMutation({
    mutationFn: (ids: number[]) => reorderProjectStages(projectId, ids),
    onSuccess: (data: any) => {
      const newStages = Array.isArray(data) ? data : data?.stages;
      qc.setQueryData(['project-stages', projectId], newStages || stages);
    },
  });

  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...stages];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[idx];
    arr[idx] = arr[j];
    arr[j] = tmp;
    const ids = arr.map((s) => s.id);
    reorderMut.mutate(ids);
  };

  // ---------- редактирование шапки проекта ----------
  const [editName, setEditName] = React.useState('');
  const [editCode, setEditCode] = React.useState('');
  const [editStatus, setEditStatus] = React.useState('');

  React.useEffect(() => {
    if (project) {
      setEditName(project.name || '');
      setEditCode(project.code || '');
      setEditStatus(project.status || '');
    }
  }, [project]);

  const saveProjectMut = useMutation({
    mutationFn: (payload: Partial<Project>) => updateProject(projectId, payload),
    onSuccess: (data: Project) => {
      qc.setQueryData(['project', projectId], data);
    },
  });

  // ---------- шаблоны этапов: применение к пустому проекту ----------
  const [templates, setTemplates] = React.useState<StageTemplate[]>([]);
  const [tplId, setTplId] = React.useState<number | ''>('');

  React.useEffect(() => {
    if (stages.length === 0) {
      fetchStageTemplates()
        .then(setTemplates)
        .catch(() => setTemplates([]));
    }
  }, [stages.length]);

  const applyTplMut = useMutation({
    mutationFn: (templateId: number) =>
      applyTemplateToProject(projectId, {
        template_id: templateId,
        replace: true,
        renumber_from: 1,
      }),
    onSuccess: (data: any) => {
      const newStages = Array.isArray(data) ? data : data?.stages;
      qc.setQueryData(['project-stages', projectId], newStages || []);
    },
  });

  // ---------- сохранение текущих этапов как шаблона ----------
  const [saveTplOpen, setSaveTplOpen] = React.useState(false);
  const [tplName, setTplName] = React.useState('');
  const [tplDesc, setTplDesc] = React.useState('');

  const saveTplMut = useMutation({
    mutationFn: () =>
      saveProjectStagesAsTemplate(projectId, {
        name: tplName || project?.name || `Шаблон проекта #${projectId}`,
        description: tplDesc,
        is_system: false,
      }),
  });
  console.log('render ProjectCardPage', { saveTplOpen });


  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Проект #{projectId}
      </Typography>

      {project && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack spacing={2}>
            <TextField
              label="Название"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Код"
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              sx={{ maxWidth: 240 }}
            />
            <TextField
              label="Статус"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              sx={{ maxWidth: 240 }}
            />

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() =>
                  saveProjectMut.mutate({
                    name: editName,
                    code: editCode,
                    status: editStatus,
                  })
                }
                disabled={saveProjectMut.isLoading}
              >
                Сохранить проект
              </Button>
            </Stack>

            {saveProjectMut.isError && (
              <Alert severity="error">Не удалось сохранить проект</Alert>
            )}
            {saveProjectMut.isSuccess && (
              <Alert severity="success">Сохранено</Alert>
            )}
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            Этапы
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={!stages.length}
            onClick={() => {
              console.log('click save template', { stagesLen: stages.length });
              setTplName(project?.name || '');
              setTplDesc('');
              setSaveTplOpen(true);
            }}
          >
            Сохранить как шаблон
          </Button>
        </Stack>

        <Stack spacing={1} sx={{ mb: 2 }}>
          {stages.map((s, idx) => (
            <Box
              key={s.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 140px 160px',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <TextField
                size="small"
                label="№"
                type="number"
                value={s.order ?? ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  qc.setQueryData(['project-stages', projectId], (prev: any) =>
                    (prev || []).map((x: any) =>
                      x.id === s.id ? { ...x, order: val } : x,
                    ),
                  );
                }}
              />
              <TextField
                size="small"
                label="Название"
                value={s.name}
                onChange={(e) => {
                  const v = e.target.value;
                  qc.setQueryData(['project-stages', projectId], (prev: any) =>
                    (prev || []).map((x: any) =>
                      x.id === s.id ? { ...x, name: v } : x,
                    ),
                  );
                }}
              />
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => move(idx, +1)}
                  disabled={idx === stages.length - 1}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => {
                    const current =
                      ((qc.getQueryData([
                        'project-stages',
                        projectId,
                      ]) as any[]) || []).find((x) => x.id === s.id);
                    saveMut.mutate({
                      id: s.id,
                      name: current?.name,
                      order: current?.order,
                    });
                  }}
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => deleteMut.mutate(s.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}

          {stages.length === 0 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Этапов пока нет.
              </Alert>

              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  select
                  label="Шаблон этапов"
                  size="small"
                  sx={{ minWidth: 260 }}
                  value={tplId}
                  onChange={(e) => setTplId(Number(e.target.value) || '')}
                >
                  {templates.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </TextField>

                <Button
                  variant="contained"
                  disabled={!tplId || applyTplMut.isLoading}
                  onClick={() => tplId && applyTplMut.mutate(Number(tplId))}
                >
                  Заполнить из шаблона
                </Button>
              </Stack>

              {applyTplMut.isError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  Не удалось применить шаблон
                </Alert>
              )}
            </Box>
          )}
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Название этапа"
            size="small"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ minWidth: 260 }}
          />
          <TextField
            label="Порядок"
            size="small"
            type="number"
            value={newOrder ?? ''}
            onChange={(e) => setNewOrder(Number(e.target.value))}
            sx={{ width: 140 }}
          />
          <Button
            variant="contained"
            onClick={() =>
              createMut.mutate({ name: newName || 'Этап', order: newOrder })
            }
            disabled={!newName || createMut.isLoading}
          >
            Добавить этап
          </Button>
        </Stack>
      </Paper>

      <Dialog open={saveTplOpen} onClose={() => setSaveTplOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Сохранить текущие этапы как шаблон</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              label="Название шаблона"
              size="small"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Описание"
              size="small"
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            {saveTplMut.isError && (
              <Alert severity="error">Не удалось сохранить шаблон</Alert>
            )}
            {saveTplMut.isSuccess && (
              <Alert severity="success">Шаблон сохранён</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            disabled={!tplName || saveTplMut.isLoading}
            onClick={() =>
              saveTplMut.mutate(undefined, {
                onSuccess: () => setSaveTplOpen(false),
              })
            }
          >
            Сохранить
          </Button>
          <Button onClick={() => setSaveTplOpen(false)}>Отмена</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
