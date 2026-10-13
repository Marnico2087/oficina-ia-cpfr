import { useState } from 'react';
import { Activity, ArrowUpRight, FolderOpen, Search, X } from 'lucide-react';
import type { AgentId, OfficeTask } from '../types';
import { useAgents } from '../agents';
import { useLanguage } from '../locales/i18n';
import { Avatar, Dot } from '../components/Avatar';
import { statusName, displayPrompt, displayEvent } from '../components/taskDisplay';

export function TaskList({ tasks, onSelect, cancel, canCancel }: {
    tasks: OfficeTask[];
    onSelect: (a: AgentId, taskId: string) => void;
    cancel: (id: string) => Promise<void>;
    canCancel: boolean;
}) {
    const { t: tr, formatTime, formatAgo } = useLanguage();
    const agents = useAgents();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [pending, setPending] = useState<Set<string>>(new Set());
    const stop = async (id: string) => {
      if (pending.has(id) || !canCancel) return;
      setPending(value => new Set(value).add(id));
      try { await cancel(id); } finally { setPending(value => { const next = new Set(value); next.delete(id); return next; }); }
    };
    const filtered = tasks.filter(t => (filter === 'all' || t.status === filter) && `${(displayPrompt(t, tr) + ' ' + t.prompt)} ${t.agentName || agents.find(a => a.id === t.agentId)?.name || t.agentId} ${t.provider || 'codex'}`.toLowerCase().includes(query.trim().toLowerCase()));
    return <><div className="sub-intro"><span className="eyebrow"><span />{" " + tr("EXECUTION HISTORY")}</span><h1>{tr("Activity & tasks")}</h1><p>{tr("Follow the details of every mission, in real time.")}</p></div><div className="task-filters"><div className="search-box"><Search size={17}/><input aria-label={tr("Search tasks or agents...")} value={query} placeholder={tr("Search tasks or agents...")} onChange={e => setQuery(e.target.value)}/></div><div>{['all', 'running', 'completed', 'failed', 'cancelled', 'interrupted'].map(f => <button aria-pressed={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)} key={f}>{f === 'all' ? tr("All tasks") : tr(statusName[f])}</button>)}</div></div>
    <div className="detail-list">{filtered.length ? filtered.map(t => <article className="detail-task" key={t.id}><div className="detail-top"><Avatar id={t.agentId}/><div><span>{t.agentName || agents.find(a => a.id === t.agentId)?.name || t.agentId} · {formatAgo(t.createdAt)}</span><h3>{displayPrompt(t, tr)}</h3><small><FolderOpen size={13}/>{t.workspace === 'Demo workspace' ? tr(t.workspace) : t.workspace}</small></div><span className={`pill-status ${t.status}`}><Dot status={t.status}/>{tr(statusName[t.status])}</span><button onClick={() => onSelect(t.agentId, t.id)} aria-label={tr("Show agent")}><ArrowUpRight size={18}/></button></div><div className="timeline">{t.events.slice(-5).reverse().map(e => <div key={e.id}><Dot status={e.kind === 'error' ? 'failed' : e.kind === 'success' ? 'completed' : 'idle'}/><time>{formatTime(e.at)}</time><span>{displayEvent(t, e.message, tr)}</span></div>)}</div>{t.status === 'running' && <button className="cancel-task" disabled={!canCancel || pending.has(t.id)} aria-busy={pending.has(t.id)} title={!canCancel ? tr("API OFFLINE") : undefined} onClick={() => void stop(t.id)}><X size={13}/>{" " + tr("Stop task")}</button>}{t.failure && <p className="failure" role="alert">{t.failure}</p>}</article>) : <div className="empty-state"><Activity size={30}/><h3>{tr("No matching tasks")}</h3><p>{tr("New activity will appear here.")}</p></div>}</div>
  </>;
}
