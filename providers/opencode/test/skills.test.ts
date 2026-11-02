import { describeSkillsCapability } from '@pragma/module-cli-integration/testing'
import { skillsCapability } from '../src/main/skills.capability'

describeSkillsCapability('opencode', skillsCapability, [
  { name: 'targets under <home>/.config/opencode/skills', env: {}, base: '<home>/.config/opencode' },
  { name: 'honours XDG_CONFIG_HOME', env: { XDG_CONFIG_HOME: '/x' }, base: '/x/opencode' },
  {
    name: 'OPENCODE_CONFIG_DIR wins over XDG_CONFIG_HOME',
    env: { OPENCODE_CONFIG_DIR: '/c', XDG_CONFIG_HOME: '/x' },
    base: '/c',
  },
])
