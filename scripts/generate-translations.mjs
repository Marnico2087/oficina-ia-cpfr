// Maintainer-only tool: creates a static translation snapshot. Neither the
// running app nor the production build makes translation service requests.
import { readFile, writeFile, rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const source = await readFile(resolve('src/locales/i18n.ts'), 'utf8')
const text = source.match(/export const phrases = `([\s\S]*?)`\.split\('\\n'\)/)?.[1]
if (!text) throw new Error('Could not locate phrase catalogue')
// JS template literals normalize CRLF; the source reader must do the same.
const phrases = text.replace(/\r\n?/g, '\n').split('\n')
const locales = ['pt-BR', 'pt-PT', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'ru', 'uk', 'tr', 'ar', 'hi', 'zh-CN', 'zh-TW', 'ja', 'ko', 'id', 'vi']
if (new Set(phrases).size !== phrases.length || phrases.some(phrase => !phrase.trim())) throw Error('Duplicate or empty source phrase')
const snapshotPath = resolve('src/locales/translations.generated.ts')
const snapshot = ts.transpileModule(await readFile(snapshotPath, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const { languagePacks: existing } = await import(`data:text/javascript;base64,${Buffer.from(snapshot).toString('base64')}`)
function validate(packs) {
  for (const locale of locales) {
    const lines = packs[locale]
    if (!Array.isArray(lines) || lines.length !== phrases.length || lines.some(line => typeof line !== 'string' || !line.trim())) {
      throw Error(`Incomplete ${locale}: ${lines?.length}/${phrases.length}`)
    }
  }
}
// Offline verification never calls a translation service or writes a snapshot.
if (process.argv.includes('--check')) {
  validate(existing)
  console.log(JSON.stringify({ locales: locales.length + 1, phrases: phrases.length, complete: true, offline: true }))
  process.exit(0)
}
const refreshAll = process.argv.includes('--refresh')
if (!refreshAll) validate(existing)
const overrides = {
  'pt-BR': {
    'MISSION CONTROL': 'CENTRAL DE CONTROLE', 'Office studio': 'Escritório 3D', 'Activity & tasks': 'Atividades e tarefas', 'Agent team': 'Equipe de agentes',
    'YOUR TEAM': 'SUA EQUIPE', 'WORKSPACE': 'ÁREA DE TRABALHO', 'Mission control': 'Central de controle', 'New task': 'Nova tarefa', 'Create a task': 'Criar tarefa',
    'Workspace settings': 'Configurações do espaço de trabalho', 'Settings': 'Configurações', 'Local workspace': 'Espaço de trabalho local',
    'Live office': 'Escritório ao vivo', 'Meet your crew': 'Conheça sua equipe', 'Task feed': 'Atividades recentes',
    'Data source': 'Fonte de dados', 'Demo environment': 'Ambiente de demonstração', 'Privacy & safety': 'Privacidade e segurança',
    'Language': 'Idioma', 'Select your preferred interface language.': 'Escolha o idioma da interface.',
    'INTERFACE LANGUAGE': 'IDIOMA DA INTERFACE', 'Changes take effect immediately and are saved on this device.': 'As alterações são imediatas e ficam salvas neste dispositivo.',
    'YOUR ENVIRONMENT': 'SEU AMBIENTE', 'Local Codex CLI': 'Codex CLI local', 'DEMO MODE': 'MODO DEMO', 'LIVE MODE': 'MODO AO VIVO',
    'Total agents': 'Total de agentes', 'Working now': 'Trabalhando agora', 'Tasks completed': 'Tarefas concluídas',
    'Workspace status': 'Status do ambiente', 'Assign a task': 'Atribuir tarefa', 'All tasks': 'Todas as tarefas',
    'Preview only · no real execution': 'Só demonstração · sem execução real', 'Open source': 'Código aberto',
    'Codex is available': 'Codex está disponível', 'Check local API': 'Verifique a API local',
    'Project directory': 'Pasta do projeto', 'PROJECT DIRECTORY': 'PASTA DO PROJETO', 'WORKSPACE PATH': 'CAMINHO DA PASTA',
    'Ready to collaborate': 'Prontos para colaborar', 'Start API and install Codex CLI': 'Inicie a API e instale o Codex CLI',
    'Code & implementation': 'Código e implementação', 'Architecture & planning': 'Arquitetura e planejamento',
    'Tests & reliability': 'Testes e confiabilidade', 'Design & experience': 'Design e experiência',
    'Developer': 'Desenvolvedor', 'Creative': 'Criativo', 'QA Engineer': 'Engenheiro de testes', 'Tech Lead': 'Líder técnico',
  },
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function translate(locale, batch) {
  const uri = new URL('https://translate.googleapis.com/translate_a/single')
  uri.search = new URLSearchParams({ client: 'gtx', sl: 'en', tl: locale, dt: 't', q: batch.join('\n') }).toString()
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await fetch(uri, { signal: AbortSignal.timeout(15000) })
      if (!result.ok) throw Error(`HTTP ${result.status}`)
      const response = await result.json()
      const lines = response[0].map(fragment => fragment[0]).join('').replace(/\r/g, '').trim().split('\n').map(x => x.trim())
      if (lines.length === batch.length && lines.every(Boolean)) return lines
      if (batch.length > 1) {
        const midpoint = Math.floor(batch.length / 2)
        return [...await translate(locale, batch.slice(0, midpoint)), ...await translate(locale, batch.slice(midpoint))]
      }
      throw Error(`Translation returned ${lines.length} lines for a single phrase`)
    } catch (error) {
      if (attempt === 3) throw new Error(`${locale}: ${error.message}`)
      await pause((attempt + 1) * 700)
    }
  }
}

const all = {}
// Sequential per language to avoid burst rate limits; per-request batches keep
// a generated locale fully aligned with the original English catalogue.
for (const locale of locales) {
  // Preserve reviewed strings by default. --refresh explicitly retranslates the full catalogue.
  if (!refreshAll) { all[locale] = [...existing[locale]]; continue }
  const lines = []
  for (let i = 0; i < phrases.length; i += 22) {
    const batch = phrases.slice(i, i + 22)
    lines.push(...await translate(locale, batch))
  }
  all[locale] = lines.map((line, index) => overrides[locale]?.[phrases[index]] ?? line)
  if (all[locale].length !== phrases.length) throw Error(`Incomplete ${locale}`)
  console.log(`${locale}: ${all[locale].length} translations`)
}
// A failed/interrupted remote generation must not replace the working app with partial packs.
validate(all)
const temporary = `${snapshotPath}.tmp`
await writeFile(temporary, `// Static locale data generated for Agent Office. Review new strings before publishing.\nexport const languagePacks: Record<string, string[]> = ${JSON.stringify(all, null, 2)}\n`, 'utf8')
await rename(temporary, snapshotPath)
