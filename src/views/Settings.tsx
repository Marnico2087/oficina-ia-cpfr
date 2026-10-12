import { FolderOpen, Languages, Radio, ShieldCheck } from 'lucide-react';
import type { ServerState } from '../types';
import { useLanguage, languages, type Locale } from '../locales/i18n';

export function Settings({ workspace, setWorkspace, demo, setDemo, server }: {
  workspace: string;
  setWorkspace: (v: string) => void;
  demo: boolean;
  setDemo: (v: boolean) => void;
  server: ServerState | null;
}) {
  const { locale, setLocale, t: tr } = useLanguage();
  return <>
    <div className="sub-intro">
      <span className="eyebrow"><span /> {tr('YOUR ENVIRONMENT')}</span>
      <h1>{tr('Workspace settings')}</h1>
      <p>{tr('Choose where your agents work and which data you want to see.')}</p>
    </div>
    <div className="settings-content">
      <section className="setting-card">
        <div className="setting-heading"><Languages size={22}/><div><h2>{tr('Language')}</h2><p>{tr('Select your preferred interface language.')}</p></div></div>
        <label htmlFor="interface-language">{tr('INTERFACE LANGUAGE')}</label>
        <select id="interface-language" className="language-picker" value={locale} onChange={event => setLocale(event.target.value as Locale)}>
          {languages.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
        <p>{tr('Changes take effect immediately and are saved on this device.')}</p>
      </section>
      <section className="setting-card">
        <div className="setting-heading"><FolderOpen size={22}/><div><h2>{tr('Project directory')}</h2><p>{tr('Choose where your agents work and which data you want to see.')}</p></div></div>
        <label htmlFor="path">{tr('WORKSPACE PATH')}</label>
        <input id="path" value={workspace} onChange={event => setWorkspace(event.target.value)} placeholder="C:\\path\\to\\project"/>
        <p>{tr('One task per project folder')}</p>
      </section>
      <section className="setting-card">
        <div className="setting-heading"><Radio size={22}/><div><h2>{tr('Data source')}</h2><p>{tr('Switch between sample activity and real Codex execution.')}</p></div></div>
        <div className="setting-row"><div><strong>{tr('Demo environment')}</strong><span>{tr('Sample events for exploring the office')}</span></div>
          <button className={`switch ${demo ? 'enabled' : ''}`} onClick={() => setDemo(!demo)} aria-pressed={demo} aria-label={tr('Demo mode')}><span /></button>
        </div>
        <p>{tr('Choose the CLI used for each task.')}</p>
        {(server?.providers || []).map(item => <div className="setting-row" key={item.id}>
          <div><strong>{item.name}</strong><span>{tr(item.available ? 'Detected on this computer' : 'Start API and install an AI CLI')}</span></div>
          <span className={`setting-ready ${item.available ? 'yes' : ''}`}>{tr(item.available ? 'READY' : 'NOT FOUND')}</span>
        </div>)}
      </section>
      <section className="setting-card">
        <div className="setting-heading"><ShieldCheck size={22}/><div><h2>{tr('Privacy & safety')}</h2><p>{tr('Your office runs locally.')}</p></div></div>
        <p>{tr('One task per project folder')}</p>
        <p>{tr('The API runs on your computer. Tasks use your installed AI CLI. Recent activity stays in .local/tasks.json.')}</p>
      </section>
    </div>
  </>;
}
