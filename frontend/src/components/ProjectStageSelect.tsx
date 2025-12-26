/**
 * Выпадающий список для выбора этапа проекта.
 *
 * Зависит от выбранного project_id: при смене проекта список этапов обновляется.
 * Используется в заявках на закупку, чтобы привязать потребность к этапу/работам на объекте.
 */

import * as React from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { http, fixPath } from '../api/_http';

type Stage = { id:number; name:string; code?:string };

async function tryEndpoints(projectId:number, q:string) {
  const endpoints = [
    `/api/projects/${projectId}/stages/`,
    `/api/stages/`,
    `/api/projects/stages/`,
  ];
  const paramsCommon:any = { page_size: 25 };
  for (const ep of endpoints) {
    try {
      const params:any = { ...paramsCommon };
      if (ep.endsWith('/stages/')) params.project = projectId;
      if (q) params.search = q;
      const { data } = await http.get(fixPath(ep), { params });
      const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
      return (arr || []).map((s:any)=> ({ id: s.id, name: s.name ?? String(s.id), code: s.code }));
    } catch (e) { /* try next */ }
  }
  return [];
}

export default function ProjectStageSelect({ projectId, value, onChange, disabled, label }:{
  projectId: number | null; value: number | null; onChange:(id:number|null)=>void; disabled?: boolean; label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<Stage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState('');

  const load = React.useCallback(async (q:string, pid:number|null) => {
    if (!pid) { setOptions([]); return; }
    setLoading(true);
    try { setOptions(await tryEndpoints(pid, q)); } finally { setLoading(false); }
  }, []);

  React.useEffect(()=> { if (open) { const h = window.setTimeout(()=> load(input.trim(), projectId), 200); return ()=> window.clearTimeout(h);} }, [open, input, projectId, load]);

  const val = value != null ? options.find(o=> o.id===value) || null : null;
  const getLabel = (o:Stage)=> (o.code ? `${o.code} — ${o.name}` : o.name);

  return (
    <Autocomplete
      sx={{ minWidth: 320 }}
      open={open} onOpen={()=> setOpen(true)} onClose={()=> setOpen(false)}
      options={options} getOptionLabel={getLabel} isOptionEqualToValue={(a,b)=> a.id===b.id}
      value={val} onChange={(_, opt)=> onChange(opt ? opt.id : null)}
      inputValue={input} onInputChange={(_, v)=> setInput(v)} disabled={disabled || !projectId}
      renderInput={(params)=>(
        <TextField {...params} size="small" label={label || 'Этап'} placeholder={projectId ? 'Поиск по имени/коду' : 'Сначала выберите проект'}
          InputProps={{ ...params.InputProps, endAdornment:(<>{loading? <CircularProgress size={16} />:null}{params.InputProps.endAdornment}</>) }}
        />
      )}
    />
  );
}
