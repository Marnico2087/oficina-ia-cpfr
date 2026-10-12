import { BrainCircuit, Code2, Layers3, ShieldCheck } from 'lucide-react';
import type { OfficeTask, TaskPhase } from '../types';

export const statusName: Record<string, string> = { running: 'In progress', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', idle: 'Available' };
export const phaseName: Record<TaskPhase, string> = { thinking: 'Thinking', coding: 'Coding', researching: 'Researching', finishing: 'Finishing', idle: 'Idle' };
const bundledDemoIds = new Set(['demo-nova', 'demo-atlas', 'demo-sentinel']);
export function displayPrompt(task: OfficeTask, translate: (text: string) => string): string {
    return bundledDemoIds.has(task.id) ? translate(task.prompt) : task.prompt;
}
export function displayEvent(task: OfficeTask, message: string, translate: (text: string) => string): string {
    return task.id.startsWith('demo-') ? translate(message) : message;
}
export const icons = { atlas: BrainCircuit, nova: Code2, pixel: Layers3, sentinel: ShieldCheck };
