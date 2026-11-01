import { describe, expect, it } from 'vitest'
import { activityAgentPath, spawnFake } from '../testing'

describe('activity agent fake', () => {
  it('echoes say and exits on exit', async () => {
    const fake = spawnFake(activityAgentPath)
    await fake.waitForOutput('ready')
    fake.send('say hello there')
    await fake.waitForOutput('hello there')
    fake.send('exit')
    expect(await fake.exited).toBe(0)
  })
})
