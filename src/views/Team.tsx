import { ArrowRight } from 'lucide-react';
import { AGENTS, type AgentId, type OfficeTask } from '../types';
import { useLanguage } from '../locales/i18n';
import { Avatar, Dot } from '../components/Avatar';
import { icons } from '../components/taskDisplay';

export function Team({ tasks, onTask }: {
    tasks: OfficeTask[];
    onTask: (id: AgentId) => void;
}) {
    const { t: tr } = useLanguage();
    return <><div className="sub-intro"><span className="eyebrow"><span />{" " + tr("YOUR DIGITAL CREW")}</span><h1>{tr("Meet your agents")}</h1><p>{tr("Four specialists, one shared mission.")}</p></div><div className="agents-grid">{AGENTS.map(a => { const Icon = icons[a.id]; const working = tasks.some(t => t.agentId === a.id && t.status === 'running'); return <article className="agent-card" key={a.id}><div className="agent-card-accent" style={{ background: a.color }}/><div className="agent-card-row"><Avatar id={a.id} size="lg"/><span className={`pill-status ${working ? 'running' : 'idle'}`}><Dot status={working ? 'running' : 'idle'}/>{working ? tr("Working") : tr("Available")}</span></div><h2>{a.name}</h2><span className="agent-role"><Icon size={16}/>{tr(a.role)}</span><p>{tr(a.specialty)}</p><div className="agent-card-foot"><span>{tasks.filter(t => t.agentId === a.id).length}{" " + tr("total tasks")}</span><button onClick={() => onTask(a.id)}>{tr("Assign task") + " "}<ArrowRight size={15}/></button></div></article>; })}</div></>;
}
