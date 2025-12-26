/**
 * Диалог создания проекта.
 *
 * Используется на странице ProjectsPage для добавления нового проекта без ухода со списка.
 */
import * as React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import { fetchStageTemplates, createProject } from '../../api/projects';

type Props = { open: boolean; onClose: () => void; onCreated: (proj: any) => void; };

export default function CreateProjectDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [template, setTemplate] = React.useState<number | ''>('');
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string>('');

  React.useEffect(()=>{
    if (open) fetchStageTemplates().then(setTemplates).catch(()=>setTemplates([]));
  }, [open]);

  const onSubmit = async () => {
    setBusy(true); setErr('');
    try {
      const payload: any = { name, code };
      if (template) payload.template = Number(template);
      const proj = await createProject(payload);
      onCreated(proj);
      setName(''); setCode(''); setTemplate('');
      onClose();
    } catch (e:any) {
      setErr(e?.response?.data?.detail || 'Не удалось создать проект');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Новый проект</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField size="small" label="Название проекта" value={name} onChange={e=>setName(e.target.value)} />
          <TextField size="small" label="Код проекта" value={code} onChange={e=>setCode(e.target.value)} helperText="Уникальный короткий шифр (например, PRJ-001)" />
          <FormControl fullWidth size="small">
            <InputLabel id="lbl-tpl">Шаблон этапов</InputLabel>
            <Select labelId="lbl-tpl" label="Шаблон этапов" value={template} onChange={(e)=> setTemplate(e.target.value as any)}>
              <MenuItem value=""><em>— без шаблона —</em></MenuItem>
              {templates.map((t:any)=>(<MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>))}
            </Select>
          </FormControl>
          {err && <Typography color="error">{err}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={onSubmit} disabled={!name || !code || busy}>Создать</Button>
      </DialogActions>
    </Dialog>
  );
}
