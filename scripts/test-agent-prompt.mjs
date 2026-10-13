import test from 'node:test'
import assert from 'node:assert/strict'
import { composeAgentPrompt } from '../server/agent-prompt.mjs'
import { DEFAULT_AGENTS, makeAgent } from '../server/agents.mjs'

test('a real agent receives its configured role and the exact user task', () => {
  const task = 'Review the rendering bug and do not modify the server.\nKeep the exact task text.'
  const prompt = composeAgentPrompt(DEFAULT_AGENTS[0], task)
  assert.match(prompt, /Atlas/)
  assert.match(prompt, /Tech Lead/)
  assert.match(prompt, /Architecture & planning/)
  assert.match(prompt, /USER TASK:\nReview the rendering bug and do not modify the server\.\nKeep the exact task text\.$/)
  const custom = makeAgent({ name: 'Audit Bot', role: 'QA', specialty: 'Visual regression', department: 'quality', color: '#123456' })
  const second = composeAgentPrompt(custom, task)
  assert.match(second, /Audit Bot/)
  assert.match(second, /Visual regression/)
  assert.ok(!second.includes('Tech Lead'), 'Role from another agent leaked into execution')
})
