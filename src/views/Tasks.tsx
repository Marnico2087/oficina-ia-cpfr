import { useState } from 'react';
import { Activity, ArrowUpRight, FolderOpen, Search, X } from 'lucide-react';
import { AGENTS, type AgentId, type OfficeTask } from '../types';
import { useLanguage } from '../locales/i18n';
import { Avatar, Dot } from '../components/Avatar';
import { statusName, displayPrompt, displayEvent } from '../components/taskDisplay';

export function TaskList({ tasks, onSelect, cancel }: {
    tasks: OfficeTask[];
    onSelect: (a: AgentId, taskId: string) => void;
    cancel: (id: string) => void;
}) {
    const { t: tr, formatTime, formatAgo } = useLanguage();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const filtered = tasks.filter(t => (filter === 'all' || t.status === filter) && `${t.prompt} ${t.agentId} ${t.provider || 'codex'}`.toLowerCase().includes(query.toLowerCase()));
    return <><div className="sub-intro"><span className="eyebrow"><span />{" " + tr("EXECUTION HISTORY")}</span><h1>{tr("Activity & tasks")}</h1><p>{tr("Follow the details of every mission, in real time.")}</p></div><div className="task-filters"><div className="search-box"><Search size={17}/><input value={query} placeholder={tr("Search tasks or agents...")} onChange={e => setQuery(e.target.value)}/></div><div>{['all', 'running', 'completed', 'failed'].map(f => <button className={filter === f ? 'on' : ''} onClick={() => setFilter(f)} key={f}>{f === 'all' ? tr("All tasks") : tr(statusName[f])}</button>)}</div></div>
    <div className="detail-list">{filtered.length ? filtered.map(t => <article className="detail-task" key={t.id}><div className="detail-top"><Avatar id={t.agentId}/><div><span>{AGENTS.find(a => a.id === t.agentId)?.name} · {formatAgo(t.createdAt)}</span><h3>{displayPrompt(t, tr)}</h3><small><FolderOpen size={13}/>{t.workspace === 'Demo workspace' ? tr(t.workspace) : t.workspace}</small></div><span className={`pill-status ${t.status}`}><Dot status={t.status}/>{tr(statusName[t.status])}</span><button onClick={() => onSelect(t.agentId, t.id)} aria-label={tr("Show agent")}><ArrowUpRight size={18}/></button></div><div className="timeline">{t.events.slice(-5).reverse().map(e => <div key={e.id}><Dot status={e.kind === 'error' ? 'failed' : e.kind === 'success' ? 'completed' : 'idle'}/><time>{formatTime(e.at)}</time><span>{displayEvent(t, e.message, tr)}</span></div>)}</div>{t.status === 'running' && <button className="cancel-task" onClick={() => cancel(t.id)}><X size={13}/>{" " + tr("Stop task")}</button>}{t.failure && <p className="failure">{t.failure}</p>}</article>) : <div className="empty-state"><Activity size={30}/><h3>{tr("No matching tasks")}</h3><p>{tr("New activity will appear here.")}</p></div>}</div>
  </>;
}
