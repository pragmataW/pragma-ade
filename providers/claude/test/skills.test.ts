import { describeSkillsCapability } from '@pragma/module-cli-integration/testing'
import { skillsCapability } from '../src/main/skills.capability'

describeSkillsCapability('claude', skillsCapability, [
  { name: 'targets under <home>/.claude/skills', env: {}, base: '<home>/.claude' },
  { name: 'ignores XDG_CONFIG_HOME', env: { XDG_CONFIG_HOME: '/x' }, base: '<home>/.claude' },
])
