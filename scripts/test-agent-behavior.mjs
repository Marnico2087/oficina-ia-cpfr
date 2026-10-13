import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAgentPose, selectAgentTask, TERMINAL_POSE_MS } from '../src/scene/agentBehavior.ts'

const now = Date.parse('2026-10-12T12:00:00.000Z')
const finishedAt = new Date(now - 1_000).toISOString()

test('idle and running tasks resolve to the visible phase', () => {
  assert.equal(resolveAgentPose(undefined, now), 'idle')
  for (const phase of ['thinking', 'coding', 'researching', 'finishing']) {
    assert.equal(resolveAgentPose({ status: 'running', phase }, now), phase)
  }
  assert.equal(resolveAgentPose({ status: 'running', phase: 'idle' }, now), 'thinking')
})

test('success and failures acknowledge the terminal task briefly', () => {
  assert.equal(resolveAgentPose({ status: 'completed', finishedAt }, now), 'celebrating')
  assert.equal(resolveAgentPose({ status: 'failed', finishedAt }, now), 'error')
  assert.equal(resolveAgentPose({ status: 'interrupted', finishedAt }, now), 'error')
  assert.equal(resolveAgentPose({ status: 'cancelled', finishedAt }, now), 'idle')
  assert.equal(resolveAgentPose({ status: 'completed', finishedAt }, now + TERMINAL_POSE_MS), 'idle')
})

test('missing, corrupt or future timestamps do not show fake completion', () => {
  for (const stamp of [undefined, 'invalid', new Date(now + 1_000).toISOString()]) {
    assert.equal(resolveAgentPose({ status: 'completed', finishedAt: stamp }, now), 'idle')
  }
})

test('current work outranks a terminal reaction from an earlier task', () => {
  const running = { id: 'running', agentId: 'nova', status: 'running', phase: 'coding', updatedAt: new Date(now - 2_000).toISOString() }
  const complete = { id: 'complete', agentId: 'nova', status: 'completed', phase: 'idle', finishedAt, updatedAt: finishedAt }
  const unrelated = { ...running, agentId: 'atlas' }
  assert.equal(selectAgentTask([running, unrelated, complete], 'nova', now)?.id, 'running')
  assert.equal(selectAgentTask([complete], 'nova', now)?.id, 'complete')
  assert.equal(selectAgentTask([running, complete], 'nova', now + TERMINAL_POSE_MS)?.id, 'running')
  assert.equal(selectAgentTask([unrelated], 'nova', now), undefined)
})
