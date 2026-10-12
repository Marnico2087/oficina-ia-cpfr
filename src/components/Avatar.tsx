import type { CSSProperties } from 'react';
import { AGENTS, type AgentId } from '../types';

export function Avatar({ id, size = 'md' }: {
    id: AgentId;
    size?: 'sm' | 'md' | 'lg';
}) {
    const agent = AGENTS.find(a => a.id === id)!;
    return <span className={`avatar avatar-${size}`} style={{ '--agent-color': agent.color } as CSSProperties}><span className="avatar-head"/><span className="avatar-shoulders"/></span>;
}

export function Dot({ status }: {
    status: string;
}) { return <span className={`dot dot-${status}`}/>; }
