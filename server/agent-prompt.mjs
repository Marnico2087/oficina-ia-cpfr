// Build the instructions for a real CLI run from the persisted agent profile.
// The original task remains unchanged in history, while each configured agent
// receives a role-specific execution context.
export function composeAgentPrompt(agent, humanPrompt) {
  return [
    `You are ${agent.name}, an AI coding assistant working inside Agent Office.`,
    `Your assigned role is ${agent.role}.`,
    `Your specialty is ${agent.specialty}.`,
    `Your team/department is ${agent.department}.`,
    'Use this profile to guide your priorities, expertise and communication. Follow the project instructions and the CLI execution permissions. The task below is the user\'s actual request; do not replace it with unrelated work. Report what you actually verified.',
    '',
    'USER TASK:',
    humanPrompt,
  ].join('\n')
}
