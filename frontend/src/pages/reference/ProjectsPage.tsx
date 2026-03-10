/**
 * Список проектов.
 *
 * Функции:
 * - просмотр проектов,
 * - создание нового проекта (через диалог),
 * - переход в карточку проекта.
 */
import * as React from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { http, fixPath } from '../../api/_http';
import CreateProjectDialog from './../projects/CreateProjectDialog';

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planned: 'План',
  active: 'В работе',
  paused: 'Пауза',
  done: 'Завершён',
};

type Project = { id: number; code: string; name: string; status: string; delivery_address?: string | null; start_date?: string | null; end_date?: string | null; };

async function fetchProjects(search: string) {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  const res = await http.get(fixPath('/api/projects/projects/') + (qs.toString() ? '?' + qs.toString() : ''));
  return res.data?.results ?? res.data ?? [];
}

export default function ProjectsPage() {
  const nav = useNavigate();
  const [search, setSearch] = React.useState('');
  const [dlg, setDlg] = React.useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['projects', search], queryFn: () => fetchProjects(search) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Проекты</Typography>
        <Button onClick={() => setDlg(true)} variant="contained">Новый проект</Button>
      </Stack>

      <TextField size="small" placeholder="Поиск по коду/названию" value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 2, minWidth: 360 }} />

      <Card variant="outlined">
        <CardContent>
          {isLoading ? <CircularProgress /> : error ? <Typography color="error">Не удалось загрузить проекты</Typography> : (
            <Table size="small" sx={{ width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '8%' }}>Код</TableCell>
                  <TableCell sx={{ width: '18%' }}>Название</TableCell>
                  <TableCell sx={{ width: '12%', whiteSpace: 'nowrap' }}>Статус</TableCell>
                  <TableCell sx={{ width: '36%' }}>Адрес объекта</TableCell>
                  <TableCell sx={{ width: '10%', whiteSpace: 'nowrap' }}>Начало</TableCell>
                  <TableCell sx={{ width: '10%', whiteSpace: 'nowrap' }}>Завершение</TableCell>
                  <TableCell sx={{ width: '6%' }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {(data as Project[]).map(p => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.code}</TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{p.name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{PROJECT_STATUS_LABELS[p.status] || p.status || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{p.delivery_address || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.start_date || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.end_date || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <Button component={Link} to={`/reference/projects/${p.id}`} size="small">Открыть</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateProjectDialog
        open={dlg}
        onClose={() => setDlg(false)}
        onCreated={(proj) => { setDlg(false); refetch(); nav(`/reference/projects/${proj.id}`); }}
      />
    </Box>
  );
}
