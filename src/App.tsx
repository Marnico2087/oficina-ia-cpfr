import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Command, Wifi, WifiOff, X } from 'lucide-react';
import { demoTasks, type AgentId, type OfficeTask, type ProviderId, type ServerState } from './types';
import { useLanguage } from './locales/i18n';
import type { View } from './views/types';
import { Dot } from './components/Avatar';
import { Sidebar } from './components/Sidebar';
import { NewTask } from './components/NewTask';
import { Studio } from './views/Studio';
import { TaskList } from './views/Tasks';
import { Team } from './views/Team';
import { Settings } from './views/Settings';

export default function App() {
    const { t: tr, formatTime } = useLanguage();
    const [view, setView] = useState<View>('studio');
    const [selected, setSelected] = useState<AgentId>('nova');
    const [selectedTask, setSelectedTask] = useState<string | null>(null);
    const [demo, setDemo] = useState(true);
    const [demoData, setDemoData] = useState(demoTasks);
    const [server, setServer] = useState<ServerState | null>(null);
    const [online, setOnline] = useState(false);
    const [workspace, setWorkspace] = useState('');
    const [provider, setProvider] = useState<ProviderId>(() => {
        try { const stored = localStorage.getItem('agent-office-provider'); if (stored === 'claude' || stored === 'gemini') return stored; } catch { /* Storage disabled */ }
        return 'codex';
    });
    const [modal, setModal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState('');
    const [now, setNow] = useState(() => new Date());
    const tasks = useMemo(() => demo ? demoData : server?.tasks || [], [demo, demoData, server]);
    const cliReady = Boolean(online && server?.providers?.some(item => item.available));
    function chooseProvider(value: ProviderId) {
        setProvider(value);
        try { localStorage.setItem('agent-office-provider', value); } catch { /* Storage disabled */ }
    }
    useEffect(() => {
        const refresh = (data: ServerState) => { setOnline(true); setServer(data); setWorkspace(v => v || data.defaultWorkspace); };
        fetch('/api/state').then(r => { if (!r.ok)
            throw Error('offline'); return r.json(); }).then(refresh).catch(() => setOnline(false));
        const stream = new EventSource('/api/events');
        stream.addEventListener('state', e => { try {
            refresh(JSON.parse((e as MessageEvent).data));
        }
        catch { /* ignore malformed packets */ } });
        stream.onerror = () => setOnline(false);
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => { stream.close(); clearInterval(timer); };
    }, []);
    function notice(message: string) { setToast(message); window.setTimeout(() => setToast(''), 4200); }
    function showNew(agent?: AgentId) { if (agent)
        setSelected(agent); setModal(true); }
    async function start(prompt: string) {
        setBusy(true);
        if (demo) {
            const id = `demo-${Date.now()}`, stamp = new Date().toISOString();
            const t: OfficeTask = { id, prompt, agentId: selected, provider, workspace: 'Demo workspace', status: 'running', phase: 'thinking', createdAt: stamp, updatedAt: stamp, finishedAt: null, lastMessage: '', threadId: null, events: [{ id: id + 'e', at: stamp, kind: 'info', message: 'Preview started. No code is executed.' }] };
            setDemoData(v => [t, ...v]);
            setSelectedTask(id);
            setModal(false);
            notice('Demo task started · preview only');
            window.setTimeout(() => setDemoData(v => v.map(x => x.id === id && x.status === 'running' ? { ...x, phase: 'coding', updatedAt: new Date().toISOString(), events: [...x.events, { id: id + 'f', at: new Date().toISOString(), kind: 'info', message: 'Simulating agent activity...' }] } : x)), 2000);
            window.setTimeout(() => setDemoData(v => v.map(x => x.id === id && x.status === 'running' ? { ...x, status: 'completed', phase: 'idle', finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [...x.events, { id: id + 'g', at: new Date().toISOString(), kind: 'success', message: 'Preview task completed.' }] } : x)), 7000);
        }
        else {
            try {
                const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: selected, provider, prompt, workspace }) });
                const result = await response.json();
                if (!response.ok)
                    throw Error(result.error || 'Could not start task');
                setSelectedTask(result.task.id);
                setModal(false);
                notice(`${server?.providers?.find(p => p.id === provider)?.name || provider} task started`);
            }
            catch (error) {
                notice(error instanceof Error ? error.message : 'Could not start task');
            }
        }
        setBusy(false);
    }
    async function cancel(id: string) {
        if (demo) {
            setDemoData(v => v.map(t => t.id === id ? { ...t, status: 'cancelled', phase: 'idle', finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : t));
            return notice('Preview stopped');
        }
        try {
            const r = await fetch(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
            if (!r.ok)
                throw Error((await r.json()).error);
            notice('Cancellation requested');
        }
        catch (e) {
            notice(e instanceof Error ? e.message : 'Cancellation failed');
        }
    }
    return <div className="shell"><Sidebar view={view} setView={setView} onNew={() => showNew()}/><div className="app-main"><header className="topbar"><div className="crumb"><span><Command size={15}/></span>{" " + tr("My workspace") + " "}<b>/</b><strong>{view === 'studio' ? tr("Office studio") : view === 'tasks' ? tr("Activity & tasks") : view === 'team' ? tr("Agent team") : tr("Settings")}</strong><ChevronDown size={13}/></div><div className="topbar-actions"><time>{formatTime(now)}</time><i /><span className={`api-badge ${cliReady ? 'on' : ''}`}>{cliReady ? <Wifi size={14}/> : <WifiOff size={14}/>} {cliReady ? tr("READY") : online ? tr("NOT FOUND") : tr("API OFFLINE")}</span><button className={`mode-btn ${demo ? 'demo' : 'live'}`} onClick={() => { setDemo(!demo); notice(demo ? tr("Showing real Codex events") : tr("Showing demo preview")); }}><Dot status={demo ? 'amber' : 'running'}/>{demo ? tr("DEMO MODE") : tr("LIVE MODE")} <ChevronDown size={13}/></button></div></header>
      <div className="page-content">{view === 'studio' && <Studio tasks={tasks} selected={selected} setSelected={setSelected} selectedTask={selectedTask} setSelectedTask={setSelectedTask} onNew={() => showNew()} demo={demo} ready={Boolean(online && server?.providers?.some(p => p.available))}/>}{view === 'tasks' && <TaskList tasks={tasks} onSelect={(id, taskId) => { setSelected(id); setSelectedTask(taskId); setView('studio'); }} cancel={cancel}/>} {view === 'team' && <Team tasks={tasks} onTask={showNew}/>} {view === 'settings' && <Settings workspace={workspace} setWorkspace={setWorkspace} demo={demo} setDemo={setDemo} server={server}/>}</div><footer><span>© 2026 Agent Office <b>✳</b>{" " + tr("Made for builders")}</span><span>v0.1.0 <i>·</i>{" " + tr("Open source")}</span></footer></div>
    {modal && <NewTask agent={selected} setAgent={setSelected} provider={provider} setProvider={chooseProvider} providers={server?.providers || []} workspace={workspace} setWorkspace={setWorkspace} close={() => setModal(false)} start={start} busy={busy} demo={demo}/>}{toast && <div className="toast"><CheckCircle2 size={17}/>{tr(toast)}<button onClick={() => setToast('')} aria-label={tr("Dismiss toast")}><X size={14}/></button></div>}
  </div>;
}
