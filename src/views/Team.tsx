import { useState } from 'react';
import { ArrowRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AgentId, Department, OfficeAgent, OfficeTask } from '../types';
import { DEPARTMENTS, suggestDepartment, useAgents } from '../agents';
import { useLanguage } from '../locales/i18n';
import { Avatar, Dot } from '../components/Avatar';
import { icons } from '../components/taskDisplay';

type AgentInput = Omit<OfficeAgent, 'id' | 'short'>;
const blank: AgentInput = { name: '', role: '', specialty: '', department: 'general', color: '#8b82ff' };

export function Team({ tasks, onTask, onSave, onDelete, connected }: {
  tasks: OfficeTask[];
  onTask: (id: AgentId) => void;
  onSave: (agent: AgentInput, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  connected: boolean;
}) {
  const { t: tr } = useLanguage();
  const agents = useAgents();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<AgentInput>(blank);
  const [customDepartment, setCustomDepartment] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = (agent?: OfficeAgent) => {
    setForm(agent ? { name: agent.name, role: agent.role, specialty: agent.specialty, department: agent.department, color: agent.color } : blank);
    setCustomDepartment(Boolean(agent));
    setEditing(agent?.id ?? 'new');
  };
  const changeProfile = (field: 'role' | 'specialty', value: string) => {
    setForm(previous => {
      const next = { ...previous, [field]: value };
      return customDepartment ? next : { ...next, department: suggestDepartment(next.role, next.specialty) };
    });
  };
  const save = async () => {
    setBusy(true);
    const ok = await onSave(form, editing === 'new' ? undefined : editing ?? undefined);
    if (ok) setEditing(null);
    setBusy(false);
  };
  const remove = async (agent: OfficeAgent) => {
    if (!window.confirm(`${tr('Remove agent')} ${agent.name}? ${tr('Their saved task history will remain.')}`)) return;
    setBusy(true);
    await onDelete(agent.id);
    setBusy(false);
  };
  return <>
    <div className="sub-intro team-intro"><div><span className="eyebrow"><span /> {tr('YOUR DIGITAL CREW')}</span><h1>{tr('Meet your agents')}</h1><p>{tr('Organize specialists into departments. The office expands automatically with your team.')}</p></div>
      <button className="primary-btn" disabled={!connected} onClick={() => open()}><Plus size={17}/>{tr('Add agent')}</button>
    </div>
    {!connected && <p className="roster-warning">{tr('Connect to your local API to manage agents.')}</p>}
    {agents.length === 0 && <div className="empty-state"><h3>{tr('No agents yet')}</h3><p>{tr('Add your first agent to build the office.')}</p></div>}
    <div className="department-summary">{DEPARTMENTS.filter(dep => agents.some(agent => agent.department === dep.id)).map(dep => <span key={dep.id}><i style={{ background: dep.color }}/>{tr(dep.name)} · {agents.filter(agent => agent.department === dep.id).length}</span>)}</div>
    <div className="agents-grid">{agents.map(a => {
      const Icon = icons[a.department];
      const working = tasks.some(t => t.agentId === a.id && t.status === 'running');
      return <article className="agent-card" key={a.id}><div className="agent-card-accent" style={{ background: a.color }}/>
        <div className="agent-card-row"><Avatar id={a.id} size="lg"/><span className={`pill-status ${working ? 'running' : 'idle'}`}><Dot status={working ? 'running' : 'idle'}/>{working ? tr('Working') : tr('Available')}</span></div>
        <h2>{a.name}</h2><span className="agent-role"><Icon size={16}/>{tr(a.role)}</span><p>{tr(a.specialty)}</p>
        <span className="department-pill">{tr(DEPARTMENTS.find(dep => dep.id === a.department)?.name || 'Shared workstations')}</span>
        <div className="agent-card-foot"><span>{tasks.filter(t => t.agentId === a.id).length} {tr('total tasks')}</span><div className="roster-actions">
          <button title={tr('Edit agent')} aria-label={`${tr('Edit agent')} ${a.name}`} onClick={() => open(a)} disabled={!connected}><Pencil size={15}/></button>
          <button title={tr('Remove agent')} aria-label={`${tr('Remove agent')} ${a.name}`} onClick={() => remove(a)} disabled={!connected || working || busy}><Trash2 size={15}/></button>
          <button onClick={() => onTask(a.id)}>{tr('Assign task')} <ArrowRight size={15}/></button>
        </div></div></article>;
    })}</div>
    {editing && <div className="modal-overlay" onMouseDown={e => { if (e.currentTarget === e.target) setEditing(null); }}><div className="modal" role="dialog" aria-modal="true" aria-label={tr('Agent details')}>
      <div className="modal-title"><h2>{tr(editing === 'new' ? 'Add agent' : 'Edit agent')}</h2><button onClick={() => setEditing(null)} aria-label={tr('Close')}><X size={18}/></button></div>
      <div className="agent-fields"><label htmlFor="agent-name">{tr('Name')}</label><input id="agent-name" maxLength={45} autoFocus value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/>
        <label htmlFor="agent-role">{tr('Role')}</label><input id="agent-role" maxLength={70} placeholder={tr('Developer, Researcher, Security engineer…')} value={form.role} onChange={e => changeProfile('role', e.target.value)}/>
        <label htmlFor="agent-specialty">{tr('Specialty / mission')}</label><textarea id="agent-specialty" rows={3} maxLength={180} placeholder={tr('What does this agent do?')} value={form.specialty} onChange={e => changeProfile('specialty', e.target.value)}/>
        <label htmlFor="agent-department">{tr('Department')}</label><select id="agent-department" className="language-picker" value={form.department} onChange={e => { setCustomDepartment(true); setForm(v => ({ ...v, department: e.target.value as Department })); }}>{DEPARTMENTS.map(dep => <option value={dep.id} key={dep.id}>{tr(dep.name)}</option>)}</select>
        <small className="department-hint">{tr(customDepartment ? 'Department selected manually.' : 'Suggested from the role and mission. You can change it.')}</small>
        <label htmlFor="agent-color">{tr('Color')}</label><input id="agent-color" type="color" value={form.color} onChange={e => setForm(v => ({ ...v, color: e.target.value }))}/>
      </div><div className="modal-bottom"><small>{tr('Agent profile and office placement are saved locally.')}</small><button className="primary-btn" disabled={busy || !form.name.trim() || !form.role.trim() || !form.specialty.trim()} onClick={save}>{tr('Save agent')} <ArrowRight size={16}/></button></div>
    </div></div>}
  </>;
}
