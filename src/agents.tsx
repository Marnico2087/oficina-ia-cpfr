import { createContext, useContext } from 'react'
import { DEFAULT_AGENTS, type OfficeAgent } from './types'

export const AgentsContext = createContext<OfficeAgent[]>(DEFAULT_AGENTS)
export const useAgents = () => useContext(AgentsContext)
export const useAgent = (id: string) => useAgents().find(agent => agent.id === id)

export const DEPARTMENTS = [
  { id: 'architecture', name: 'Architecture & planning', color: '#9b91ff' },
  { id: 'engineering', name: 'Engineering lab', color: '#51c5ec' },
  { id: 'design', name: 'Creative studio', color: '#ffb47f' },
  { id: 'quality', name: 'Quality & testing', color: '#75deb0' },
  { id: 'research', name: 'Research library', color: '#d6b7ff' },
  { id: 'operations', name: 'Operations center', color: '#e8d17f' },
  { id: 'security', name: 'Security operations', color: '#ec8e9d' },
  { id: 'data', name: 'Data & analytics', color: '#7fcbdd' },
  { id: 'general', name: 'Shared workstations', color: '#a7b7cd' },
] as const

/** A suggestion only: when there is no convincing clue, use the shared office. */
export function suggestDepartment(role: string, specialty: string): OfficeAgent['department'] {
  const job = `${role} ${specialty}`.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const patterns: [OfficeAgent['department'], RegExp][] = [
    ['security', /\b(security|cyber|seguranca|infosec|pentest|threat|vulnerability|vulnerabilidade|appsec)\b/],
    ['data', /\b(data|dados|analytics|analise de dados|bi|database|banco de dados|etl|sql|machine learning)\b/],
    ['quality', /\b(qa|quality|tester|testing|testes|qualidade|reliability|confiabilidade)\b/],
    ['architecture', /\b(architect|architecture|arquiteto|arquitetura|planejamento|technical lead|tech lead)\b/],
    ['design', /\b(design|creative|criativo|ux|ui|visual|illustration|ilustracao|interface)\b/],
    ['research', /\b(research|pesquisa|pesquisador|investigacao|investigador|literature|bibliografia)\b/],
    ['operations', /\b(operations|operacoes|devops|sre|infraestrutura|deployment|deploy|monitoramento)\b/],
    ['engineering', /\b(developer|desenvolvedor|desenvolvimento|programador|programming|coding|engenheiro de software|software engineer|frontend|backend)\b/],
  ]
  return patterns.find(([, pattern]) => pattern.test(job))?.[0] ?? 'general'
}
