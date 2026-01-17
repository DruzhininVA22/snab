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

type Project = { id: number; code: string; name: string; status: string; start_date?: string | null; end_date?: string | null; };

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
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Код</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Начало</TableCell>
                  <TableCell>Завершение</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data as Project[]).map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{p.start_date || '—'}</TableCell>
                    <TableCell>{p.end_date || '—'}</TableCell>
                    <TableCell><Button component={Link} to={`/reference/projects/${p.id}`} size="small">Открыть</Button></TableCell>
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
