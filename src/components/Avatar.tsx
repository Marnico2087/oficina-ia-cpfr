import type { CSSProperties } from 'react';
import type { AgentId } from '../types';
import { useAgent } from '../agents';

export function Avatar({ id, size = 'md' }: {
    id: AgentId;
    size?: 'sm' | 'md' | 'lg';
}) {
    const agent = useAgent(id);
    return <span aria-hidden="true" className={`avatar avatar-${size}`} style={{ '--agent-color': agent?.color || '#9ba9c2' } as CSSProperties}><span className="avatar-head"/><span className="avatar-shoulders"/></span>;
}

export function Dot({ status }: {
    status: string;
}) { return <span aria-hidden="true" className={`dot dot-${status}`}/>; }
