import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import http from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { validateVscodePackage } from './prepare-vscode-package.mjs'
const require = createRequire(import.meta.url)
const { freePort, waitUntilReady, resolveLaunch } = require('../vscode-extension/runtime.cjs')
const { activate, deactivate } = require('../vscode-extension/extension.cjs')

test('VS Code extension contributes the command and workspace configuration', () => {
  const manifest = require('../vscode-extension/package.json')
  assert.ok(manifest.contributes.commands.some(item => item.command === 'agent-office.open'))
  assert.ok(manifest.contributes.configuration.properties['agentOffice.command'])
})

test('VS Code package includes every actual runtime dependency without bundling private data', async () => {
  const files = await validateVscodePackage()
  assert.ok(files.includes('runtime.cjs')); assert.ok(files.includes('extension.cjs'))
  assert.ok(!files.some(file => /\.local|node_modules|credentials/.test(file)))
})

test('VS Code command refuses opening without a workspace folder', async () => {
  let command
  const errors = []
  const vscode = {
    window: { createOutputChannel: () => ({ append() {}, appendLine() {}, show() {}, dispose() {} }), showErrorMessage: x => errors.push(x) },
    workspace: { workspaceFolders: [] },
    commands: { registerCommand(_name, handler) { command = handler; return { dispose() {} } } },
  }
  activate({ subscriptions: [] }, vscode)
  await command()
  assert.match(errors[0], /Open a project folder/)
  await deactivate()
})

test('IDE readiness rejects unrelated services, wrong instances, dead children and stalled responses', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/state') { res.writeHead(200); res.end(JSON.stringify({ connected:true,agents:[],tasks:[],providers:[],instanceId:'wrong' })) }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await assert.rejects(waitUntilReady(server.address().port, {exitCode:null,signalCode:null,killed:false}, 200, {instanceId:'expected'}), /did not start/)
    await assert.rejects(waitUntilReady(server.address().port, {exitCode:0,signalCode:null,killed:false}, 200), /stopped/)
    await assert.rejects(waitUntilReady(server.address().port, {agentOfficeError:new Error('fixture start failed')}, 200), /fixture start failed/)
  } finally { await new Promise(resolve => server.close(resolve)) }
  const stalled = http.createServer((_req, res) => { res.writeHead(200); res.write('{') })
  await new Promise(resolve => stalled.listen(0, '127.0.0.1', resolve))
  try {
    await assert.rejects(waitUntilReady(stalled.address().port, {exitCode:null,signalCode:null,killed:false}, 150), /did not start/)
  } finally { stalled.closeAllConnections(); await new Promise(resolve => stalled.close(resolve)) }
})

test('IDE resolves Windows npm shims and paths with spaces without a shell', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-office-ide-shim-'))
  try {
    await writeFile(join(root, 'node.exe'), '')
    await writeFile(join(root, 'agent-office.cmd'), '')
    const bin = join(root, 'node_modules', 'agent-office', 'bin')
    await mkdir(bin, { recursive:true }); await writeFile(join(bin, 'agent-office.mjs'), '')
    assert.deepEqual(resolveLaunch('agent-office', {PATH:root}, 'win32'), {command:join(root,'node.exe'),args:[join(bin,'agent-office.mjs')]})
    const direct = join(root, 'literal & executable.exe'); await writeFile(direct, '')
    assert.deepEqual(resolveLaunch(direct, {}, 'win32'), {command:direct,args:[]})
    assert.throws(() => resolveLaunch('agent-office & injected', {PATH:root}, 'win32'), /not found/)
    assert.throws(() => resolveLaunch('agent-office\n', {PATH:root}, 'win32'), /without shell arguments/)
  } finally { assert.ok(root.startsWith(join(tmpdir(), 'agent-office-ide-shim-'))); await rm(root, {recursive:true,force:true}) }
})

test('IDE serializes repeated opens, uses canonical workspace, and stops its disposable CLI', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-office-ide-'))
  const cli = join(root, 'fake office & cli.cjs'), record = join(root, 'launches.json')
  await writeFile(cli, `
const fs=require('node:fs'),http=require('node:http')
const args=process.argv.slice(2)
const port=Number(args[args.indexOf('--port')+1]),folder=args[args.indexOf('--workspace')+1]
const path=process.env.AO_IDE_RECORD
const launches=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):[]
launches.push({args,folder,pid:process.pid});fs.writeFileSync(path,JSON.stringify(launches))
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({connected:true,agents:[],tasks:[],providers:[],defaultWorkspace:folder,instanceId:process.env.AGENT_OFFICE_INSTANCE_ID}))}).listen(port,'127.0.0.1')
process.on('message',message=>{if(message.type==='agent-office:shutdown' && message.instanceId===process.env.AGENT_OFFICE_INSTANCE_ID)process.exit(0)})
`)
  const savedRecord = process.env.AO_IDE_RECORD, savedPath = process.env.PATH
  process.env.AO_IDE_RECORD = record
  process.env.PATH = dirname(process.execPath) + delimiter + (savedPath || '')
  let command
  const opened = [], errors = []
  const vscode = {
    ViewColumn:{Beside:2},
    window:{createOutputChannel:()=>({append(){},appendLine(){},show(){},dispose(){}}),showErrorMessage:message=>errors.push(message)},
    workspace:{isTrusted:true,workspaceFolders:[{uri:{fsPath:root}}],getConfiguration:()=>({get:()=>cli})},
    commands:{registerCommand(_name,handler){command=handler;return{dispose(){}}},async executeCommand(name,url){opened.push({name,url})}},
  }
  try {
    activate({subscriptions:[]},vscode)
    await Promise.all([command(),command()])
    assert.deepEqual(errors,[])
    assert.equal(opened.length,2); assert.equal(opened[0].url,opened[1].url)
    const launches=JSON.parse(await readFile(record,'utf8'))
    assert.equal(launches.length,1,'Concurrent opens must share one startup')
    assert.deepEqual(launches[0].args,['--no-open','--port',new URL(opened[0].url).port,'--workspace',root])
    await deactivate()
    await assert.rejects(fetch(opened[0].url,{signal:AbortSignal.timeout(200)}))
  } finally {
    await deactivate()
    if(savedRecord===undefined) delete process.env.AO_IDE_RECORD; else process.env.AO_IDE_RECORD=savedRecord
    if(savedPath===undefined) delete process.env.PATH; else process.env.PATH=savedPath
    assert.ok(root.startsWith(join(tmpdir(),'agent-office-ide-')))
    await rm(root,{recursive:true,force:true})
  }
})

test('IDE refuses commands from untrusted workspaces', async () => {
  let command
  const errors=[]
  activate({subscriptions:[]},{
    window:{createOutputChannel:()=>({dispose(){}}),showErrorMessage:message=>errors.push(message)},
    workspace:{isTrusted:false,workspaceFolders:[{uri:{fsPath:tmpdir()}}]},
    commands:{registerCommand(_name,handler){command=handler;return{dispose(){}}}},
  })
  await command(); assert.match(errors[0],/Trust this workspace/); await deactivate()
})

test('IDE local port probe awaits the real API', async () => {
  const port = await freePort()
  const server = http.createServer((req, res) => {
    res.writeHead(req.url === '/api/state' ? 200 : 404)
    res.end(JSON.stringify({ connected: true, agents: [], tasks: [], providers: [] }))
  })
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  try {
    await waitUntilReady(port, { exitCode: null, signalCode: null, killed: false }, 800)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
