import { createContext, useContext } from 'react'
import { DEFAULT_OFFICE_PREFERENCES, type OfficePreferences } from './officePreferences'

export type OfficePreferencesContextValue = {
  preferences: OfficePreferences
  updatePreferences: (update: Partial<OfficePreferences>) => void
}
export const OfficePreferencesContext = createContext<OfficePreferencesContextValue>({
  preferences: DEFAULT_OFFICE_PREFERENCES, updatePreferences: () => {},
})
export const useOfficePreferences = () => useContext(OfficePreferencesContext)
