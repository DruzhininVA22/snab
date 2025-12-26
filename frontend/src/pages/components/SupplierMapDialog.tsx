/**
 * Диалог сопоставления поставщиков (SupplierMap).
 *
 * Применяется при импорте прайс-листов: пользователь связывает "сырые" строки из Excel
 * с реальными поставщиками справочника, чтобы импорт прошёл корректно.
 */
import React, { useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { upsertSupplierMap } from '../../api/supplierMap';

/**
 * Диалог сопоставления позиций поставщика с нашей номенклатурой.
 */
export default function SupplierMapDialog({ open, onClose, rows, onMapped }: any) {
  const [items, setItems] = useState<any[]>(() =>
    (rows || []).map((r:any) => ({
      row: r.row,
      supplier: r.supplier,
      supplier_id: r.supplier_id,
      supplier_sku: r.item_sku,
      selection: null,
      candidates: r.candidates || []
    }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upserted, setUpserted] = useState<number | null>(null);

  const unmapped = useMemo(() => items, [items]);

  const handleChange = (idx:number, value:any) => {
    setItems(prev => prev.map((it,i) => i===idx ? { ...it, selection: value } : it));
  };

  const handleUpsert = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = items
        .filter(it => it.selection && it.selection.id && (it.supplier || it.supplier_id))
        .map(it => ({
          supplier: it.supplier,
          supplier_id: it.supplier_id,
          supplier_sku: it.supplier_sku,
          item_id: it.selection.id
        }));
      if (payload.length === 0) {
        setError('Нечего сохранять — выберите соответствия в списке.');
        setLoading(false);
        return;
      }
      const res = await upsertSupplierMap(payload);
      const count = res?.upserted || 0;
      setUpserted(count);
      if (typeof onMapped === 'function') onMapped(count);
    } catch (e:any) {
      setError(e?.message || 'Ошибка при сохранении сопоставлений');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Сопоставление позиций поставщика</DialogTitle>
      <DialogContent dividers>
        <p className="text-sm text-gray-600">
          Выберите соответствующий <b>наш SKU</b> для каждой позиции поставщика. Сопоставления будут запомнены для будущих импортов.
        </p>
        <div className="space-y-3">
          {unmapped.map((it:any, idx:number) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-4">
                <div className="text-xs text-gray-500">Поставщик SKU</div>
                <div className="font-mono">{it.supplier_sku}</div>
                <div className="text-xs text-gray-500">{it.supplier || ''}</div>
              </div>
              <div className="col-span-8">
                <Autocomplete
                  size="small"
                  options={(it.candidates || []).map((c:any) => ({ id: c.id, label: c.sku }))}
                  getOptionLabel={(opt:any) => opt?.label || ''}
                  value={it.selection}
                  onChange={(_, val:any) => handleChange(idx, val)}
                  renderInput={(params) => (
                    <TextField {...params} label="Наш SKU" placeholder="Начните вводить SKU..." />
                  )}
                  freeSolo={false}
                />
              </div>
            </div>
          ))}
        </div>
        {error && <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">{error}</div>}
        {upserted !== null && <div className="mt-3 p-2 bg-green-50 rounded text-sm">Сохранено сопоставлений: <b>{upserted}</b></div>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleUpsert} disabled={loading} variant="contained">Сохранить сопоставления</Button>
      </DialogActions>
    </Dialog>
  );
}
