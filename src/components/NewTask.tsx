import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { AGENTS, type AgentId, type ProviderId, type ProviderInfo } from '../types';
import { useLanguage } from '../locales/i18n';
import { Avatar } from './Avatar';

const defaultProviders: ProviderInfo[] = [
  { id: 'codex', name: 'Codex CLI', available: false },
  { id: 'claude', name: 'Claude Code', available: false },
  { id: 'gemini', name: 'Gemini CLI', available: false },
];

export function NewTask({ agent, setAgent, workspace, setWorkspace, close, start, busy, demo, provider, setProvider, providers }: {
  agent: AgentId;
  setAgent: (a: AgentId) => void;
  workspace: string;
  setWorkspace: (v: string) => void;
  close: () => void;
  start: (prompt: string) => void;
  busy: boolean;
  demo: boolean;
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  providers: ProviderInfo[];
}) {
  const { t: tr } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const options = providers.length ? providers : defaultProviders;
  const available = demo || options.some(item => item.id === provider && item.available);

  return <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-mission">
      <div className="modal-title">
        <div><span className="eyebrow"><span /> {tr('A NEW MISSION')}</span><h2 id="new-mission">{tr('Create a task')} <b>✳</b></h2></div>
        <button onClick={close} aria-label={tr('Close')}><X size={19}/></button>
      </div>
      <label htmlFor="prompt">{tr('WHAT DO YOU WANT TO BUILD?')}</label>
      <textarea id="prompt" maxLength={10000} autoFocus rows={5} placeholder={tr('Example: Analyze this project, identify performance bottlenecks and improve them...')} value={prompt} onChange={event => setPrompt(event.target.value)}/>
      <label>{tr('ASSIGN TO')}</label>
      <div className="modal-agent-list">
        {AGENTS.map(item => <button key={item.id} className={agent === item.id ? 'selected' : ''} onClick={() => setAgent(item.id)}>
          <Avatar id={item.id} size="sm"/>{item.name}{agent === item.id && <Check size={14}/>}
        </button>)}
      </div>
      <label htmlFor="task-provider">{tr('AI provider')}</label>
      <select id="task-provider" className="language-picker" value={provider} onChange={event => setProvider(event.target.value as ProviderId)}>
        {options.map(item => <option key={item.id} value={item.id} disabled={!demo && !item.available}>
          {item.name}{!demo && !item.available ? ` (${tr('NOT FOUND')})` : ''}
        </option>)}
      </select>
      <label htmlFor="mission-dir">{tr('PROJECT DIRECTORY')}</label>
      <input id="mission-dir" value={workspace} onChange={event => setWorkspace(event.target.value)} placeholder={tr('Absolute project path')} disabled={demo}/>
      <div className="modal-bottom">
        <span><ShieldCheck size={15}/>{demo ? tr('Preview only · no real execution') : tr('Runs locally with selected CLI')}</span>
        <button className="primary-btn" disabled={!prompt.trim() || busy || !available} onClick={() => start(prompt)}>
          {busy ? tr('Starting...') : tr('Launch task')} <ArrowRight size={17}/>
        </button>
      </div>
    </div>
  </div>;
}
