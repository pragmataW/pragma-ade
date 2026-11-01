import { useT } from '@pragma/sdk/renderer'
import type { StartPrep, TaskDto } from '../../contract'
import { useStartPrep, useStartRunner } from '../lib/use-start'
import { boardActions } from '../store'
import { Field } from './Field'
import { StartFailureText, StartWorkBox, useStartOptions } from './StartWorkBox'
import { WorktreeField } from './WorktreeField'

function Loaded({ task, prep }: { task: TaskDto; prep: StartPrep }) {
  const t = useT()
  const [options, setOptions] = useStartOptions(prep)
  const runner = useStartRunner()
  const startHere = () =>
    runner.run(
      boardActions.startInWorktree({
        taskId: task.id,
        worktreeId: task.worktreeId as string,
        profileId: options.profileId,
        sendPrompt: options.sendPrompt,
      }),
    )
  return (
    <>
      <div className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2">
        <Field label={t('board:drawer.worktree')}>
          <WorktreeField task={task} prep={prep} running={runner.running} onStartHere={() => void startHere()} />
        </Field>
      </div>
      <StartWorkBox
        task={task}
        prep={prep}
        options={options}
        setOptions={setOptions}
        running={runner.running}
        onStart={(p) => void runner.run(p)}
      />
      <StartFailureText failure={runner.failure} />
    </>
  )
}

/** Worktree link + Start work box (after `prepareStart` answered). */
export function StartSection({ task }: { task: TaskDto }) {
  const prep = useStartPrep(task)
  if (!prep.data) return null
  return <Loaded key={task.id} task={task} prep={prep.data} />
}
