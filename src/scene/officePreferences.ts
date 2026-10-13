import type { Department } from '../types'

export type OfficeTheme = 'daylight' | 'midnight' | 'warm'
export type OfficeSpacing = 'compact' | 'regular' | 'spacious'
export type OfficeMotion = 'off' | 'subtle' | 'lively'

export type OfficePreferences = {
  theme: OfficeTheme
  spacing: OfficeSpacing
  motion: OfficeMotion
  accent: string
  sectorColors: Partial<Record<Department, string>>
}

export const OFFICE_PREFERENCES_KEY = 'agent-office-appearance-v1'
export const DEFAULT_OFFICE_PREFERENCES: OfficePreferences = {
  theme: 'daylight', spacing: 'regular', motion: 'lively', accent: '#547fc0', sectorColors: {},
}

// Only accept known presentation values. Stored preferences are never interpreted as commands.
export function normalizeOfficePreferences(value: unknown): OfficePreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const colors = input.sectorColors && typeof input.sectorColors === 'object' && !Array.isArray(input.sectorColors) ? input.sectorColors as Record<string, unknown> : {}
  const sectorColors: Partial<Record<Department, string>> = {}
  for (const id of ['engineering', 'architecture', 'design', 'quality', 'research', 'data', 'security', 'operations', 'general'] as Department[]) {
    if (typeof colors[id] === 'string' && /^#[0-9a-fA-F]{6}$/.test(colors[id])) sectorColors[id] = colors[id]
  }
  return {
    theme: ['daylight', 'midnight', 'warm'].includes(String(input.theme)) ? input.theme as OfficeTheme : DEFAULT_OFFICE_PREFERENCES.theme,
    spacing: ['compact', 'regular', 'spacious'].includes(String(input.spacing)) ? input.spacing as OfficeSpacing : DEFAULT_OFFICE_PREFERENCES.spacing,
    motion: ['off', 'subtle', 'lively'].includes(String(input.motion)) ? input.motion as OfficeMotion : DEFAULT_OFFICE_PREFERENCES.motion,
    accent: typeof input.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent : DEFAULT_OFFICE_PREFERENCES.accent,
    sectorColors,
  }
}

export function loadOfficePreferences(): OfficePreferences {
  try { return normalizeOfficePreferences(JSON.parse(localStorage.getItem(OFFICE_PREFERENCES_KEY) || 'null')) }
  catch { return { ...DEFAULT_OFFICE_PREFERENCES } }
}
