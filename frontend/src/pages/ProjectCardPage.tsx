/**
 * Карточка проекта.
 *
 * Позволяет просматривать основные атрибуты проекта и связанные этапы.
 * Дополнительно может использоваться как точка входа для управления этапами.
 */
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Paper, Typography, Stack, TextField, Button, Divider, Alert, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchProject,
  fetchProjectStages,
  createStageWithFallback,
  type Project,
  type ProjectStage,
} from '../api/projects';
import { updateStage, deleteStage, reorderProjectStages } from '../api/projects.extra';

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

  const [newName, setNewName] = React.useState('Новый этап');
  const nextOrder = React.useMemo(() => {
    const orders = (stages || []).map(s => s.order || 0);
    return (orders.length ? Math.max(...orders) : 0) + 1;
  }, [stages]);
  const [newOrder, setNewOrder] = React.useState<number>(nextOrder);
  React.useEffect(() => setNewOrder(nextOrder), [nextOrder]);

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
    const ids = arr.map(s => s.id);
    reorderMut.mutate(ids);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>Проект #{projectId}</Typography>
      {project && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1">{project.name} <Typography component="span" color="text.secondary">({project.code})</Typography></Typography>
          <Typography variant="body2" color="text.secondary">Статус: {project.status || '—'}</Typography>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Этапы</Typography>

        <Stack spacing={1} sx={{ mb: 2 }}>
          {stages.map((s, idx) => (
            <Box key={s.id} sx={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px 160px', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                label="№"
                type="number"
                value={s.order ?? ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  qc.setQueryData(['project-stages', projectId], (prev: any) =>
                    (prev || []).map((x: any) => x.id === s.id ? { ...x, order: val } : x)
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
                    (prev || []).map((x: any) => x.id === s.id ? { ...x, name: v } : x)
                  );
                }}
              />
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowUpwardIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => move(idx, +1)} disabled={idx === stages.length - 1}><ArrowDownwardIcon fontSize="small" /></IconButton>
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" color="primary" onClick={() => {
                  const current = (qc.getQueryData(['project-stages', projectId]) as any[] || []).find(x => x.id === s.id);
                  saveMut.mutate({ id: s.id, name: current?.name, order: current?.order });
                }}><SaveIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => deleteMut.mutate(s.id)}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            </Box>
          ))}
          {stages.length === 0 && (
            <Typography variant="body2" color="text.secondary">Этапов пока нет.</Typography>
          )}
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label="Название этапа" size="small" value={newName} onChange={(e) => setNewName(e.target.value)} sx={{ minWidth: 260 }} />
          <TextField label="Порядок" size="small" type="number" value={newOrder ?? ''} onChange={(e) => setNewOrder(Number(e.target.value))} sx={{ width: 140 }} />
          <Button variant="contained" onClick={() => createMut.mutate({ name: newName || 'Этап', order: newOrder })} disabled={!newName || createMut.isLoading}>
            Добавить этап
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
