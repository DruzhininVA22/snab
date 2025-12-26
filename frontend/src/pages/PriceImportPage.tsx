/**
 * Страница импорта прайс-листа в SNAB.
 *
 * Назначение:
 * - загрузка Excel-файла с ценами поставщиков;
 * - предварительный просмотр ошибок/сопоставлений (preview);
 * - применение импорта с возможностью открыть диалог сопоставления поставщиков (SupplierMap).
 *
 * Транспорт: используем общий axios-клиент `http` из `api/_http`.
 * Он настроен на работу с сессионной аутентификацией и CSRF.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PreviewIcon from '@mui/icons-material/Preview';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import SupplierMapDialog from './components/SupplierMapDialog';

import { http, fixPath } from '../api/_http';

type PreviewRow = {
  row: number;
  valid: boolean;
  errors?: Record<string, any> | null;
  supplier?: string;
  item?: number | null;
  item_sku: string;
  candidates?: Array<{ id: number; sku: string }>;
  price: number;
  currency: string;
  lead_days?: number | null;
  pack_qty?: number | null;
  moq_qty?: number | null;
  mo_amount?: number | null;
  lot_step?: number | null;
  vat_included?: boolean | null;
  vat_rate?: number | null;
  delivery_fixed?: number | null;
  delivery_per_unit?: number | null;
  dt?: string;
};

export default function PriceImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ ok: boolean; preview: boolean; rows: PreviewRow[]; errors: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
  }, []);

  const doPreview = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await http.post(fixPath('/api/procurement/pricerecords/import_excel/'), form, {
        params: { preview: 1 },
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Ошибка превью импорта');
    } finally {
      setBusy(false);
    }
  }, [file]);

  const doImport = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await http.post(fixPath('/api/procurement/pricerecords/import_excel/'), form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`Импорт завершён. Создано строк: ${res.data?.created ?? 0}`);
      setPreview(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Ошибка импорта');
    } finally {
      setBusy(false);
    }
  }, [file]);

  const rows = preview?.rows || [];
  const unmappedRows = useMemo(
    () => rows.filter((r: any) => r.errors && r.errors.item_sku),
    [rows]
  );

  const onMapped = useCallback((count: number) => {
    setMapOpen(false);
    if (file) {
      setTimeout(() => doPreview(), 100);
    }
  }, [file, doPreview]);

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Импорт прайс-листов</Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
              Выбрать файл (.xlsx)
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={onPickFile}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {file ? file.name : 'Файл не выбран'}
            </Typography>
            <Box flexGrow={1} />
            <Button variant="outlined" startIcon={<PreviewIcon />} onClick={doPreview} disabled={!file || busy}>
              Превью
            </Button>
            <Button
              variant="contained"
              startIcon={<DoneAllIcon />}
              onClick={doImport}
              disabled={!file || busy || !preview || (unmappedRows.length > 0)}
              title={unmappedRows.length > 0 ? 'Есть не сопоставленные позиции — сопоставьте их' : ''}
            >
              Импорт
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<CompareArrowsIcon />}
              onClick={() => setMapOpen(true)}
              disabled={unmappedRows.length === 0}
            >
              Сопоставить позиции
            </Button>
            {busy && <CircularProgress size={20} />}
          </Box>
        </CardContent>
      </Card>

      {preview && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Результат превью: валидных строк {rows.filter(r => r.valid).length}, ошибок {preview.errors}
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Поставщик</th>
                    <th className="text-left p-2">Поставщик SKU / Наш SKU</th>
                    <th className="text-left p-2">Цена</th>
                    <th className="text-left p-2">ETA</th>
                    <th className="text-left p-2">Упаковка/MOQ/LOT</th>
                    <th className="text-left p-2">Ошибки</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const err = r.errors || {};
                    const isUnmapped = !!err.item_sku;
                    return (
                      <tr key={r.row} className={isUnmapped ? 'bg-yellow-50' : (r.valid ? '' : 'bg-red-50')}>
                        <td className="p-2">{r.row}</td>
                        <td className="p-2">{r.supplier || ''}</td>
                        <td className="p-2">
                          <div className="font-mono">{r.item_sku}</div>
                          {r.item ? <div className="text-xs text-gray-600">item_id: {r.item}</div> : null}
                          {r.candidates && r.candidates.length > 0 && (
                            <div className="text-xs text-gray-500">кандидаты: {r.candidates.map(c => c.sku).join(', ')}</div>
                          )}
                        </td>
                        <td className="p-2">{r.price} {r.currency}</td>
                        <td className="p-2">{r.lead_days ?? ''} дн.</td>
                        <td className="p-2">
                          pack {r.pack_qty ?? ''} / moq {r.moq_qty ?? ''} / lot {r.lot_step ?? ''}
                        </td>
                        <td className="p-2">
                          {isUnmapped && <span className="text-amber-700">item_sku: {String(err.item_sku)}</span>}
                          {Object.keys(err).filter(k => k !== 'item_sku').length > 0 && (
                            <div className="text-red-700">{JSON.stringify(err)}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </CardContent>
        </Card>
      )}

      <SupplierMapDialog
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        rows={unmappedRows.map((r: any) => ({ row: r.row, supplier: r.supplier, item_sku: r.item_sku, candidates: r.candidates }))}
        onMapped={onMapped}
      />
    </Box>
  );
}
