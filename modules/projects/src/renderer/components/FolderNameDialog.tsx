import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@pragma/ui/components/dialog'
import { Input } from '@pragma/ui/components/input'
import { type FormEvent, useState } from 'react'
import { BUTTON_TYPES, BUTTON_VARIANTS, FIELD_IDS, FOLDER_NAME_MAX_CHARS } from '../../constants'
import { FolderNameSchema, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { useRuntime, useUi } from '../lib/runtime'
import { useProjectsAction } from '../lib/use-projects-action'
import type { FolderDialogState } from '../ui-store'
import { ErrorText } from './ErrorText'
import { Field } from './Field'

/** Creates the folder (`folderId: null`) or renames it; resolves true when it worked. */
function useSaveFolder(state: FolderDialogState) {
  const create = useProjectsAction(projectsIpc.createFolder)
  const rename = useProjectsAction(projectsIpc.renameFolder)
  const action = state.folderId === null ? create : rename
  const save = async (name: string): Promise<boolean> => {
    const { projectId, folderId, worktreeId } = state
    if (folderId !== null) return (await rename.run({ projectId, folderId, name })) !== undefined
    return (await create.run({ projectId, name, ...(worktreeId ? { worktreeId } : {}) })) !== undefined
  }
  return { save, error: action.error, pending: action.pending }
}

function FolderNameForm({ state, onDone }: { state: FolderDialogState; onDone(): void }) {
  const t = useT()
  const [name, setName] = useState(state.name)
  const { save, error, pending } = useSaveFolder(state)
  const creating = state.folderId === null
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (await save(name)) onDone()
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <Field id={FIELD_IDS.folderName} label={t('projects:folderDialog.name')}>
        <Input
          id={FIELD_IDS.folderName}
          data-testid={T.folderName}
          autoFocus
          maxLength={FOLDER_NAME_MAX_CHARS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
      </Field>
      <ErrorText error={error} />
      <DialogFooter>
        <Button type={BUTTON_TYPES.button} variant={BUTTON_VARIANTS.outline} onClick={onDone}>
          {t('projects:folderDialog.cancel')}
        </Button>
        <Button
          type={BUTTON_TYPES.submit}
          data-testid={T.folderSubmit}
          disabled={pending || !FolderNameSchema.safeParse(name).success}
        >
          {creating ? t('projects:folderDialog.create') : t('projects:folderDialog.rename')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** The name dialog of `ui.folderDialog` (new folder, or rename). */
export function FolderNameDialog() {
  const t = useT()
  const { ui } = useRuntime()
  const state = useUi((s) => s.folderDialog)
  const close = () => ui.setState({ folderDialog: null })
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && close()}>
      {state && (
        <DialogContent data-testid={T.folderDialog} className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {state.folderId === null
                ? t('projects:folderDialog.createTitle')
                : t('projects:folderDialog.renameTitle')}
            </DialogTitle>
          </DialogHeader>
          <FolderNameForm key={`${state.projectId}:${state.folderId ?? ''}`} state={state} onDone={close} />
        </DialogContent>
      )}
    </Dialog>
  )
}
