/**
 * Страница "Дашборд".
 *
 * Показывает сводные метрики по закупкам и движению заявок/заказов.
 * Источник данных: api/dashboard.ts.
 */
import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, CircularProgress } from '@mui/material';
import { fetchOverviewMetrics } from '../api/dashboard';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await fetchOverviewMetrics();
        setData(d);
      } catch (e: any) {
        setError(e?.message || 'Ошибка загрузки метрик');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Box p={3}><CircularProgress /></Box>;
  if (error) return <Box p={3}><Typography color="error">{error}</Typography></Box>;

  const cards = [
    { title: 'Всего заявок', value: data?.purchase_requests_total },
    { title: 'Открытые заявки', value: data?.purchase_requests_open },
    { title: 'Ожидают заказа', value: data?.lines_waiting ?? data?.waiting_lines ?? 0 },
    { title: 'Горят (ETA)', value: data?.hot ?? data?.sla_red ?? data?.sla_hot ?? 0 },
    { title: 'Желтеют (ETA)', value: data?.warn ?? data?.sla_yellow ?? data?.sla_warn ?? 0 },
    { title: 'Зелёная зона', value: data?.ok ?? data?.sla_green ?? data?.sla_ok ?? 0 },
  ];


  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Дашборд снабженца</Typography>
      <Grid container spacing={2}>
        {cards.map((c, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">{c.title}</Typography>
                <Typography variant="h5">{c.value ?? '—'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box mt={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>Сырые метрики (для отладки)</Typography>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
