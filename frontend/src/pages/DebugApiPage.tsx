/**
 * Страница для отладки API.
 *
 * Используется разработчиками/аналитиками, чтобы быстро проверить доступность эндпоинтов,
 * структуру ответов и корректность CSRF/session авторизации.
 */
import * as React from 'react';
import axios from 'axios';
import { Box, Button, Divider, Stack, Typography, Paper, TextField } from '@mui/material';
import { http } from '../api/_http';

type Log = {
    id: number;
    t: string;
    method: string;
    url: string;
    status?: number;
    ok?: boolean;
    ms?: number;
    note?: string;
    req?: any;
    res?: any;
    err?: any;
};

function nowIso() {
    const d = new Date();
    return d.toISOString().replace('T', ' ').replace('Z', '');
}

export default function DebugApiPage() {
    const [logs, setLogs] = React.useState<Log[]>([]);
    const [nextId, setNextId] = React.useState(1);
    const [projName, setProjName] = React.useState('DBG Проект');
    const [projCode, setProjCode] = React.useState('DBG-' + Math.floor(Math.random() * 100000));
    const [customUrl, setCustomUrl] = React.useState('/api/projects/projects/');

    // http → window для тестов из консоли
    React.useEffect(() => {
        // @ts-ignore
        (window as any).__http = http;
    }, []);

    const pushLog = (l: Partial<Log>) => {
        const id = nextId;
        setNextId(id + 1);
        const item: Log = {
            id,
            t: nowIso(),
            method: l.method || '',
            url: l.url || '',
            status: l.status,
            ok: l.ok,
            ms: l.ms,
            note: l.note,
            req: l.req,
            res: l.res,
            err: l.err,
        };
        setLogs((prev) => [item, ...prev].slice(0, 200));
    };

    async function doFetchCsrf() {
        const started = performance.now();
        try {
            const res = await fetch('/api/auth/csrf/', { credentials: 'include' });
            pushLog({ method: 'GET', url: '/api/auth/csrf/ (fetch)', status: res.status, ok: res.ok, ms: Math.round(performance.now() - started) });
        } catch (err: any) {
            pushLog({ method: 'GET', url: '/api/auth/csrf/ (fetch)', err: { message: err?.message }, ms: Math.round(performance.now() - started) });
        }
    }

    async function doAxiosRawCsrf() {
        const ax = axios.create({
            baseURL: (http.defaults?.baseURL || '').toString().replace(/\/+$/, '').replace(/\/api$/i, ''),
            withCredentials: true,
        });
        const started = performance.now();
        try {
            const res = await ax.get('/api/auth/csrf/');
            pushLog({ method: 'GET', url: '/api/auth/csrf/ (axios raw)', status: res.status, ok: true, ms: Math.round(performance.now() - started) });
        } catch (err: any) {
            pushLog({
                method: 'GET',
                url: '/api/auth/csrf/ (axios raw)',
                err: { status: err?.response?.status, data: err?.response?.data },
                ms: Math.round(performance.now() - started),
            });
        }
    }

    async function doAxiosGet(url: string, note?: string) {
        const started = performance.now();
        try {
            const res = await http.get(url);
            pushLog({
                method: 'GET',
                url: note ? `${url} (${note})` : url,
                status: res.status,
                ok: true,
                ms: Math.round(performance.now() - started),
                res: res.data,
            });
        } catch (err: any) {
            pushLog({
                method: 'GET',
                url,
                status: err?.response?.status,
                ok: false,
                ms: Math.round(performance.now() - started),
                err: { data: err?.response?.data },
            });
        }
    }

    async function doAxiosPost(url: string, payload: any) {
        const started = performance.now();
        try {
            const res = await http.post(url, payload);
            pushLog({
                method: 'POST',
                url,
                status: res.status,
                ok: true,
                ms: Math.round(performance.now() - started),
                req: payload,
                res: res.data,
            });
        } catch (err: any) {
            pushLog({
                method: 'POST',
                url,
                status: err?.response?.status,
                ok: false,
                ms: Math.round(performance.now() - started),
                req: payload,
                err: { data: err?.response?.data },
            });
        }
    }

    function cookieStr() {
        try {
            return document.cookie || '(no cookies)';
        } catch {
            return '(no cookies)';
        }
    }

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
                Диагностика API
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body2">
                    origin: <b>{window.location.origin}</b> · axios.baseURL:{' '}
                    <b>{String(http.defaults?.baseURL || '') || '(empty)'}</b>
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    cookies: {cookieStr()}
                </Typography>
            </Paper>

            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                <Button variant="outlined" onClick={doFetchCsrf}>
                    GET /api/auth/csrf/ (fetch)
                </Button>
                <Button variant="outlined" onClick={doAxiosRawCsrf}>
                    GET /api/auth/csrf/ (axios raw)
                </Button>
                <Button variant="contained" onClick={() => doAxiosGet('/api/projects/projects/')}>
                    GET /api/projects/projects/
                </Button>
                <Button variant="contained" onClick={() => doAxiosGet('/api/procurement/purchase-requests/')}>
                    GET /api/procurement/purchase-requests/
                </Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                <TextField size="small" label="Код проекта" value={projCode} onChange={(e) => setProjCode(e.target.value)} />
                <TextField size="small" label="Название проекта" value={projName} onChange={(e) => setProjName(e.target.value)} sx={{ minWidth: 260 }} />
                <Button onClick={() => doAxiosPost('/api/projects/projects/', { code: projCode, name: projName })} variant="contained">
                    POST /projects (создать)
                </Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                <TextField size="small" fullWidth label="Произвольный GET URL" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
                <Button onClick={() => doAxiosGet(customUrl)} variant="outlined">
                    Выполнить GET
                </Button>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Логи запросов
            </Typography>
            <Box sx={{ display: 'grid', gap: 1 }}>
                {logs.map((l) => (
                    <Paper key={l.id} variant="outlined" sx={{ p: 1.2 }}>
                        <Typography variant="caption" color="text.secondary">
                            {l.t}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                            {l.method} {l.url} → {l.status ?? '—'} {l.ok ? '✔' : l.status ? '✖' : ''}{' '}
                            {typeof l.ms === 'number' ? `(${l.ms} ms)` : ''}
                        </Typography>
                        {l.req && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(l.req, null, 2)}</pre>}
                        {l.res && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(l.res, null, 2)}</pre>}
                        {l.err && (
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'crimson' }}>
                                {JSON.stringify(l.err, null, 2)}
                            </pre>
                        )}
                    </Paper>
                ))}
            </Box>
        </Box>
    );
}
