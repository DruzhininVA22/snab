/**
 * Список закупочных заказов (PO).
 *
 * Показывает зарегистрированные заказы поставщикам.
 * Данные берутся через api/po.ts.
 */
import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress } from '@mui/material';
import { listPurchaseOrders } from '../api/po';

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await listPurchaseOrders();
        const items = (data?.results ?? data) as any[];
        setRows(Array.isArray(items) ? items : []);
      } catch (e:any) {
        setError(e?.message || 'Ошибка загрузки заказов');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Box p={3}><CircularProgress /></Box>;
  if (error) return <Box p={3}><Typography color="error">{error}</Typography></Box>;

  const normalize = (r: any, key: string, fallback: any = '—') => {
    if (r == null) return fallback;
    if (key in r) return r[key] ?? fallback;
    // часто данные внутри 'data'/'attributes'
    if (r.data && key in r.data) return r.data[key] ?? fallback;
    return fallback;
  };

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Заказы поставщикам</Typography>
      <Card variant="outlined">
        <CardContent>
          {rows.length === 0 ? (
            <Typography color="text.secondary">Заказов пока нет</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Номер</TableCell>
                  <TableCell>Поставщик</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Сумма</TableCell>
                  <TableCell>Создан</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r:any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{normalize(r, 'number') || normalize(r, 'code')}</TableCell>
                    <TableCell>{normalize(r, 'supplier_name') || normalize(r, 'supplier') || '—'}</TableCell>
                    <TableCell>{normalize(r, 'status') || 'draft'}</TableCell>
                    <TableCell>{normalize(r, 'total_amount') || normalize(r, 'total') || '—'}</TableCell>
                    <TableCell>{normalize(r, 'created_at') || normalize(r, 'created') || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Box mt={2}>
        <Typography variant="subtitle2" color="text.secondary">Сырые данные (отладка)</Typography>
        <pre style={{margin:0, whiteSpace:'pre-wrap'}}>{JSON.stringify(rows, null, 2)}</pre>
      </Box>
    </Box>
  );
}
