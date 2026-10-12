import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { AGENTS, type AgentId } from '../types';
import { useLanguage } from '../locales/i18n';
import { Avatar } from './Avatar';

export function NewTask({ agent, setAgent, workspace, setWorkspace, close, start, busy, demo }: {
    agent: AgentId;
    setAgent: (a: AgentId) => void;
    workspace: string;
    setWorkspace: (v: string) => void;
    close: () => void;
    start: (prompt: string) => void;
    busy: boolean;
    demo: boolean;
}) {
    const { t: tr } = useLanguage();
    const [prompt, setPrompt] = useState('');
    return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget)
        close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-mission"><div className="modal-title"><div><span className="eyebrow"><span />{" " + tr("A NEW MISSION")}</span><h2 id="new-mission">{tr("Create a task") + " "}<b>✳</b></h2></div><button onClick={close} aria-label={tr("Close")}><X size={19}/></button></div><label htmlFor="prompt">{tr("WHAT DO YOU WANT TO BUILD?")}</label><textarea id="prompt" maxLength={10000} autoFocus placeholder={tr("Example: Analyze this project, identify performance bottlenecks and improve them...")} value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}/><label>{tr("ASSIGN TO")}</label><div className="modal-agent-list">{AGENTS.map(a => <button key={a.id} className={agent === a.id ? 'selected' : ''} onClick={() => setAgent(a.id)}><Avatar id={a.id} size="sm"/>{a.name}{agent === a.id && <Check size={14}/>}</button>)}</div><label htmlFor="mission-dir">{tr("PROJECT DIRECTORY")}</label><input id="mission-dir" value={workspace} onChange={e => setWorkspace(e.target.value)} placeholder={tr("Absolute project path")} disabled={demo}/><div className="modal-bottom"><span><ShieldCheck size={15}/>{demo ? tr("Preview only \u00B7 no real execution") : tr("Runs locally with Codex")}</span><button className="primary-btn" disabled={!prompt.trim() || busy} onClick={() => start(prompt)}>{busy ? tr("Starting...") : tr("Launch task")} <ArrowRight size={17}/></button></div></div></div>;
}
