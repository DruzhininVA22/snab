import * as React from 'react';
import { Box, Card, CardContent, Grid, Typography, Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { http, fixPath } from '../api/_http';
import OperationalTable from '../components/dashboard/OperationalTable';

type DocType = 'pr' | 'quote' | 'po' | 'shipment';
type OpsCounts = { overdue: number; due_soon: number; ok: number; total: number };
type OpsGroup = { label: string; counts: OpsCounts; rows: any[] };
type OpsResponse = { generated_at: string; threshold_days: number; groups: Record<DocType, OpsGroup> };

function SummaryCard({ title, counts }: { title: string; counts: OpsCounts }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Typography variant="h6" sx={{ color: 'error.main' }}>
            {counts.overdue}
          </Typography>
          <Typography variant="h6" sx={{ color: 'warning.main' }}>
            {counts.due_soon}
          </Typography>
          <Typography variant="h6" sx={{ color: 'success.main' }}>
            {counts.ok}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Просрочено / скоро / остальное
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const q = useQuery<OpsResponse>({
    queryKey: ['dashboard-ops'],
    queryFn: async () => {
      const { data } = await http.get(fixPath('/api/dashboard/ops/'));
      return data as OpsResponse;
    },
  });

  const g = q.data?.groups;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Дашборд
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard title="Заявки" counts={g?.pr?.counts || { overdue: 0, due_soon: 0, ok: 0, total: 0 }} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard title="КП" counts={g?.quote?.counts || { overdue: 0, due_soon: 0, ok: 0, total: 0 }} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard title="Заказы" counts={g?.po?.counts || { overdue: 0, due_soon: 0, ok: 0, total: 0 }} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard title="Доставки" counts={g?.shipment?.counts || { overdue: 0, due_soon: 0, ok: 0, total: 0 }} />
        </Grid>
      </Grid>

      <OperationalTable />
    </Box>
  );
}
