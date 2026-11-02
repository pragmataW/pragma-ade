import { useT } from '@pragma/sdk/renderer'
import type { TaskDto } from '../../contract'
import { useStartPrep, useStartRunner } from '../lib/use-start'
import { boardActions } from '../store'
import { Field } from './Field'
import { StartFailureText, StartWorkBox, useStartOptions } from './StartWorkBox'
import { WorktreeField } from './WorktreeField'

/** One drawer's start state, shared by the Worktree field ("Start agent in this worktree") and the Start work box. */
export function useStartFlow(task: TaskDto) {
  const prep = useStartPrep(task).data ?? null
  const [options, setOptions] = useStartOptions(prep)
  const runner = useStartRunner()
  const startHere = () =>
    void runner.run(
      boardActions.startInWorktree({
        taskId: task.id,
        worktreeId: task.worktreeId as string,
        profileId: options.profileId,
        sendPrompt: options.sendPrompt,
      }),
    )
  return { prep, options, setOptions, runner, startHere }
}

export type StartFlow = ReturnType<typeof useStartFlow>

/** The Worktree row of the drawer's field grid (after `prepareStart` answered). */
export function WorktreeRow({ task, flow }: { task: TaskDto; flow: StartFlow }) {
  const t = useT()
  if (!flow.prep) return null
  return (
    <Field label={t('board:drawer.worktree')}>
      <WorktreeField task={task} prep={flow.prep} running={flow.runner.running} onStartHere={flow.startHere} />
    </Field>
  )
}

/** The Start work box and the last start failure (after `prepareStart` answered). */
export function StartSection({ task, flow }: { task: TaskDto; flow: StartFlow }) {
  if (!flow.prep) return null
  return (
    <>
      <StartWorkBox
        task={task}
        prep={flow.prep}
        options={flow.options}
        setOptions={flow.setOptions}
        running={flow.runner.running}
        onStart={(p) => void flow.runner.run(p)}
      />
      <StartFailureText failure={flow.runner.failure} />
    </>
  )
}
