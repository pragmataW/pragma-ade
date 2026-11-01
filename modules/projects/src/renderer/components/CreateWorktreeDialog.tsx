import { useLatestAsync, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@pragma/ui/components/dialog'
import { Input } from '@pragma/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { type FormEvent, useState } from 'react'
import { BUTTON_TYPES, BUTTON_VARIANTS, FIELD_IDS } from '../../constants'
import { type Project, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { useProjects, useRuntime, useUi } from '../lib/runtime'
import { runAction, useProjectsAction } from '../lib/use-projects-action'
import { useSuggestedPath } from '../lib/use-suggested-path'
import { ErrorText } from './ErrorText'
import { Field } from './Field'

/** Branch names for the datalist and the base picker (the default base first). */
function useBranchNames(project: Project): string[] {
  const { ipc } = useRuntime()
  const branches = useLatestAsync(
    () => runAction(ipc, projectsIpc.listBranches, { projectId: project.id }),
    [ipc, project.id],
  )
  const names = branches.data?.ok ? branches.data.value.map((b) => b.name) : []
  return [project.defaultBaseBranch, ...names.filter((n) => n !== project.defaultBaseBranch)]
}

function CreateWorktreeForm({ project, onDone }: { project: Project; onDone(): void }) {
  const t = useT()
  const names = useBranchNames(project)
  const [branch, setBranch] = useState('')
  const [base, setBase] = useState(project.defaultBaseBranch)
  const [path, setPath] = useState('')
  const [pathEdited, setPathEdited] = useState(false)
  useSuggestedPath(project.id, branch.trim(), pathEdited, setPath)
  const create = useProjectsAction(projectsIpc.createWorktree)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const done = await create.run({
      projectId: project.id,
      branch: branch.trim(),
      baseBranch: base,
      path: path || undefined,
    })
    if (done) onDone()
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <Field
        id={FIELD_IDS.branch}
        label={t('projects:createWorktree.branch')}
        hint={t('projects:createWorktree.branchHint')}
      >
        <Input
          id={FIELD_IDS.branch}
          data-testid={T.createBranch}
          list={FIELD_IDS.branchList}
          autoFocus
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="[font-family:var(--font-code)]"
        />
        <datalist id={FIELD_IDS.branchList}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>
      <Field id={FIELD_IDS.base} label={t('projects:createWorktree.baseBranch')}>
        <Select value={base} onValueChange={setBase}>
          <SelectTrigger id={FIELD_IDS.base} data-testid={T.createBase} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {names.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id={FIELD_IDS.path} label={t('projects:createWorktree.location')}>
        <Input
          id={FIELD_IDS.path}
          data-testid={T.createPath}
          value={path}
          onChange={(e) => {
            setPathEdited(true)
            setPath(e.target.value)
          }}
          className="[font-family:var(--font-code)] text-[12px]"
        />
      </Field>
      <ErrorText error={create.error} testId={T.createError} />
      <DialogFooter>
        <Button type={BUTTON_TYPES.button} variant={BUTTON_VARIANTS.outline} onClick={onDone}>
          {t('projects:createWorktree.cancel')}
        </Button>
        <Button
          type={BUTTON_TYPES.submit}
          data-testid={T.createSubmit}
          disabled={branch.trim() === '' || create.pending}
        >
          {create.pending ? t('projects:createWorktree.creating') : t('projects:createWorktree.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** "New worktree" dialog for `ui.createFor` (branch with datalist, base branch, location). */
export function CreateWorktreeDialog() {
  const t = useT()
  const { ui } = useRuntime()
  const projectId = useUi((s) => s.createFor)
  const project = useProjects((s) => s.projects.find((p) => p.id === projectId) ?? null)
  const close = () => ui.setState({ createFor: null })
  return (
    <Dialog open={project !== null} onOpenChange={(open) => !open && close()}>
      {project && (
        <DialogContent data-testid={T.createDialog} className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{t('projects:createWorktree.title')}</DialogTitle>
          </DialogHeader>
          <CreateWorktreeForm key={project.id} project={project} onDone={close} />
        </DialogContent>
      )}
    </Dialog>
  )
}
