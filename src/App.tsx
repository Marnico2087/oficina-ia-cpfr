import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Command, Wifi, WifiOff, X } from 'lucide-react';
import { DEFAULT_AGENTS, demoTasks, type AgentId, type OfficeAgent, type OfficeTask, type ProviderId, type ServerState } from './types';
import { AgentsContext } from './agents';
import { useLanguage } from './locales/i18n';
import type { View } from './views/types';
import { Dot } from './components/Avatar';
import { Sidebar } from './components/Sidebar';
import { NewTask } from './components/NewTask';
import { Studio } from './views/Studio';
import { TaskList } from './views/Tasks';
import { Team } from './views/Team';
import { Settings } from './views/Settings';
import { OfficePreferencesContext } from './scene/OfficePreferencesContext';
import { loadOfficePreferences, normalizeOfficePreferences, OFFICE_PREFERENCES_KEY } from './scene/officePreferences';
import { loadDemoRoster, makeDemoAgent, saveDemoRoster, validateDemoAgent } from './demo/roster';

const PUBLIC_DEMO = import.meta.env.MODE === 'public-demo';

export default function App() {
    const { t: tr, formatTime } = useLanguage();
    const [view, setView] = useState<View>('studio');
    const [selected, setSelected] = useState<AgentId>('nova');
    const [selectedTask, setSelectedTask] = useState<string | null>(null);
    const [demo, setDemo] = useState(true);
    const [demoData, setDemoData] = useState(demoTasks);
    const [server, setServer] = useState<ServerState | null>(null);
    const [online, setOnline] = useState(false);
    const [demoRoster, setDemoRoster] = useState<OfficeAgent[]>(() => PUBLIC_DEMO ? loadDemoRoster() : []);
    const [workspace, setWorkspace] = useState('');
    const [officePreferences, setOfficePreferences] = useState(loadOfficePreferences);
    function updateOfficePreferences(update: Partial<typeof officePreferences>) {
        setOfficePreferences(current => {
            const next = normalizeOfficePreferences({ ...current, ...update });
            try { localStorage.setItem(OFFICE_PREFERENCES_KEY, JSON.stringify(next)); } catch { /* Storage disabled */ }
            return next;
        });
    }
    const [provider, setProvider] = useState<ProviderId>(() => {
        try { const stored = localStorage.getItem('agent-office-provider'); if (stored === 'claude' || stored === 'gemini') return stored; } catch { /* Storage disabled */ }
        return 'codex';
    });
    const [modal, setModal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState('');
    const [now, setNow] = useState(() => new Date());
    const agents = PUBLIC_DEMO ? demoRoster : server?.agents ?? DEFAULT_AGENTS;
    // Sample tasks belong only to sample agents that still exist in this user's roster.
    const tasks = useMemo(() => demo ? demoData.filter(task => agents.some(agent => agent.id === task.agentId)) : server?.tasks || [], [demo, demoData, server, agents]);
    const resolvedSelected = agents.some(agent => agent.id === selected) ? selected : agents[0]?.id ?? '';
    const cliReady = Boolean(online && server?.providers?.some(item => item.available));
    function chooseProvider(value: ProviderId) {
        setProvider(value);
        try { localStorage.setItem('agent-office-provider', value); } catch { /* Storage disabled */ }
    }
    useEffect(() => {
        if (PUBLIC_DEMO) {
            const timer = setInterval(() => setNow(new Date()), 30000);
            return () => clearInterval(timer);
        }
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
    useEffect(() => { if (PUBLIC_DEMO) saveDemoRoster(demoRoster); }, [demoRoster]);
    function notice(message: string) { setToast(message); window.setTimeout(() => setToast(''), 4200); }
    function showNew(agent?: AgentId) { if (!agents.length) { setView('team'); notice('Add an agent to create tasks'); return; }
        setSelected(agent || resolvedSelected); setModal(true); }
    async function start(prompt: string) {
        setBusy(true);
        if (demo) {
            const id = `demo-${Date.now()}`, stamp = new Date().toISOString();
            const t: OfficeTask = { id, prompt, agentId: resolvedSelected, agentName: agents.find(a => a.id === resolvedSelected)?.name, provider, workspace: 'Demo workspace', status: 'running', phase: 'thinking', createdAt: stamp, updatedAt: stamp, finishedAt: null, lastMessage: '', threadId: null, events: [{ id: id + 'e', at: stamp, kind: 'info', message: 'Preview started. No code is executed.' }] };
            setDemoData(v => [t, ...v]);
            setSelectedTask(id);
            setModal(false);
            notice('Demo task started · preview only');
            window.setTimeout(() => setDemoData(v => v.map(x => x.id === id && x.status === 'running' ? { ...x, phase: 'coding', updatedAt: new Date().toISOString(), events: [...x.events, { id: id + 'f', at: new Date().toISOString(), kind: 'info', message: 'Simulating agent activity...' }] } : x)), 2000);
            window.setTimeout(() => setDemoData(v => v.map(x => x.id === id && x.status === 'running' ? { ...x, status: 'completed', phase: 'idle', finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [...x.events, { id: id + 'g', at: new Date().toISOString(), kind: 'success', message: 'Preview task completed.' }] } : x)), 7000);
        }
        else {
            try {
                const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: resolvedSelected, provider, prompt, workspace }) });
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
    async function saveAgent(input: Omit<OfficeAgent, 'id' | 'short'>, id?: string) {
        if (PUBLIC_DEMO) {
            const agent = makeDemoAgent(input, id);
            if (!validateDemoAgent(agent)) { notice('Invalid agent details'); return false; }
            if (!id && demoRoster.length >= 1000) { notice('Preview is limited to 1000 agents'); return false; }
            setDemoRoster(current => id ? current.map(item => item.id === id ? agent : item) : [...current, agent]);
            setSelected(agent.id);
            notice(id ? 'Agent updated' : 'Agent created');
            return true;
        }
        try {
            const response = await fetch(id ? `/api/agents/${encodeURIComponent(id)}` : '/api/agents', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || 'Unable to save agent');
            // The SSE snapshot can arrive before the POST response. Never append an already delivered agent twice.
            setServer(value => value && ({ ...value, agents: value.agents.some(item => item.id === result.agent.id)
                ? value.agents.map(item => item.id === result.agent.id ? result.agent : item)
                : [...value.agents, result.agent] }));
            setSelected(result.agent.id);
            notice(id ? 'Agent updated' : 'Agent created');
            return true;
        } catch (error) { notice(error instanceof Error ? error.message : 'Unable to save agent'); return false; }
    }
    async function deleteAgent(id: string) {
        if (PUBLIC_DEMO) {
            setDemoRoster(current => current.filter(item => item.id !== id));
            if (id === selected) { setSelected(agents.find(item => item.id !== id)?.id || ''); setSelectedTask(null); }
            notice('Agent removed');
            return true;
        }
        try {
            const response = await fetch(`/api/agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!response.ok) throw Error((await response.json()).error || 'Unable to remove agent');
            setServer(value => value && ({ ...value, agents: value.agents.filter(item => item.id !== id) }));
            if (id === selected) { setSelected(agents.find(item => item.id !== id)?.id || ''); setSelectedTask(null); }
            notice('Agent removed');
            return true;
        } catch (error) { notice(error instanceof Error ? error.message : 'Unable to remove agent'); return false; }
    }
    return <OfficePreferencesContext.Provider value={{ preferences: officePreferences, updatePreferences: updateOfficePreferences }}><AgentsContext.Provider value={agents}><div className="shell"><Sidebar view={view} setView={setView} onNew={() => showNew()}/><div className="app-main"><header className="topbar"><div className="crumb"><span><Command size={15}/></span>{" " + tr("My workspace") + " "}<b>/</b><strong>{view === 'studio' ? tr("Office studio") : view === 'tasks' ? tr("Activity & tasks") : view === 'team' ? tr("Agent team") : tr("Settings")}</strong><ChevronDown size={13}/></div><div className="topbar-actions"><time>{formatTime(now)}</time><i />{PUBLIC_DEMO ? <span className="api-badge on"><Wifi size={14}/>{tr('Demo environment')}</span> : <span className={`api-badge ${cliReady ? 'on' : ''}`}>{cliReady ? <Wifi size={14}/> : <WifiOff size={14}/>} {cliReady ? tr("READY") : online ? tr("NOT FOUND") : tr("API OFFLINE")}</span>}{PUBLIC_DEMO ? <span className="mode-btn demo"><Dot status="amber"/>{tr('DEMO MODE')}</span> : <button className={`mode-btn ${demo ? 'demo' : 'live'}`} onClick={() => { setDemo(!demo); notice(demo ? tr("Showing real Codex events") : tr("Showing demo preview")); }}><Dot status={demo ? 'amber' : 'running'}/>{demo ? tr("DEMO MODE") : tr("LIVE MODE")} <ChevronDown size={13}/></button>}</div></header>
      <div className="page-content">{view === 'studio' && <Studio tasks={tasks} selected={resolvedSelected} setSelected={setSelected} selectedTask={selectedTask} setSelectedTask={setSelectedTask} onNew={() => showNew()} demo={demo} ready={Boolean(online && server?.providers?.some(p => p.available))}/>}{view === 'tasks' && <TaskList tasks={tasks} onSelect={(id, taskId) => { setSelected(id); setSelectedTask(taskId); setView('studio'); }} cancel={cancel}/>} {view === 'team' && <Team tasks={tasks} onTask={showNew} onSave={saveAgent} onDelete={deleteAgent} connected={PUBLIC_DEMO || online}/>} {view === 'settings' && <Settings workspace={workspace} setWorkspace={setWorkspace} demo={demo} setDemo={setDemo} server={server} publicPreview={PUBLIC_DEMO}/>}</div><footer><span>© 2026 Agent Office <b>✳</b>{" " + tr("Made for builders")}</span><span>v0.3.0 <i>·</i>{" " + tr("Open source")}</span></footer></div>
    {modal && agents.length > 0 && <NewTask agent={resolvedSelected} setAgent={setSelected} provider={provider} setProvider={chooseProvider} providers={server?.providers || []} workspace={workspace} setWorkspace={setWorkspace} close={() => setModal(false)} start={start} busy={busy} demo={demo}/>}{toast && <div className="toast"><CheckCircle2 size={17}/>{tr(toast)}<button onClick={() => setToast('')} aria-label={tr("Dismiss toast")}><X size={14}/></button></div>}
  </div></AgentsContext.Provider></OfficePreferencesContext.Provider>;
}
