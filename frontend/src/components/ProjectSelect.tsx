/**
 * Выпадающий список для выбора проекта.
 *
 * Компонент отвечает за:
 * - загрузку списка проектов из API,
 * - отображение (code/name),
 * - возврат выбранного project_id в родительскую форму.
 */

import * as React from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { http, fixPath } from '../api/_http';

type Project = { id:number; name:string; code?:string };

export default function ProjectSelect({ value, onChange, disabled, label }:{
  value: number | null; onChange: (id:number|null)=>void; disabled?: boolean; label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState('');

  const load = React.useCallback(async (q:string) => {
    setLoading(true);
    try {
      const params:any = { page_size: 25 };
      if (q) params.search = q;
      const { data } = await http.get(fixPath('/api/projects/'), { params });
      const arr = Array.isArray((data as any)?.results) ? (data as any).results : (data as any);
      setOptions((arr||[]).map((p:any)=> ({ id: p.id, name: p.name ?? String(p.id), code: p.code })));
    } finally { setLoading(false); }
  }, []);

  React.useEffect(()=> { if (open) { const h = window.setTimeout(()=> load(input.trim()), 200); return ()=> window.clearTimeout(h);} }, [open, input, load]);
  React.useEffect(()=> {
    if (!value || options.some(o=> o.id===value)) return;
    let alive = true;
    (async ()=>{
      try { const { data } = await http.get(fixPath(`/api/projects/${value}/`));
            const pr = { id: data.id, name: data.name ?? String(data.id), code: data.code };
            if (alive) setOptions(prev => [pr, ...prev]); } catch {}
    })();
    return ()=> { alive = false; };
  }, [value, options]);

  const val = value != null ? options.find(o=> o.id===value) || null : null;
  const getLabel = (o:Project)=> (o.code ? `${o.code} — ${o.name}` : o.name);

  return (
    <Autocomplete
      sx={{ minWidth: 320 }}
      open={open} onOpen={()=> setOpen(true)} onClose={()=> setOpen(false)}
      options={options} getOptionLabel={getLabel} isOptionEqualToValue={(a,b)=> a.id===b.id}
      value={val} onChange={(_, opt)=> onChange(opt ? opt.id : null)}
      inputValue={input} onInputChange={(_, v)=> setInput(v)} disabled={disabled}
      renderInput={(params)=>(
        <TextField {...params} size="small" label={label || 'Проект'} placeholder="Поиск по имени/коду"
          InputProps={{ ...params.InputProps, endAdornment:(<>{loading? <CircularProgress size={16} />:null}{params.InputProps.endAdornment}</>) }}
        />
      )}
    />
  );
}
