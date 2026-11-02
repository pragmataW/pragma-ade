import { useModuleSettings, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Input } from '@pragma/ui/components/input'
import { useState } from 'react'
import { FIELD_IDS } from '../../constants'
import { type ProjectsSettings, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { useProjectsAction } from '../lib/use-projects-action'
import { ErrorText } from './ErrorText'
import { Field } from './Field'

/** Settings › Projects: the folder new worktrees are created in. */
export function ProjectsSettingsPage() {
  const t = useT()
  const settings = useModuleSettings<ProjectsSettings>()
  const [root, setRoot] = useState(settings.worktreesRoot)
  const [saved, setSaved] = useState(false)
  const save = useProjectsAction(projectsIpc.updateSettings)
  const submit = async () => {
    setSaved(Boolean(await save.run({ worktreesRoot: root.trim() })))
  }
  return (
    <div className="flex max-w-[520px] flex-col gap-3">
      <Field
        id={FIELD_IDS.root}
        label={t('projects:settings.worktreesRoot')}
        hint={t('projects:settings.worktreesRootHint')}
      >
        <Input
          id={FIELD_IDS.root}
          data-testid={T.settingsRoot}
          value={root}
          onChange={(e) => {
            setSaved(false)
            setRoot(e.target.value)
          }}
          className="font-mono text-[12px]"
        />
      </Field>
      <ErrorText error={save.error} />
      <div className="flex items-center gap-3">
        <Button data-testid={T.settingsSave} disabled={save.pending} onClick={() => void submit()}>
          {t('projects:settings.save')}
        </Button>
        {saved && <span className="text-[12px] text-ok">{t('projects:settings.saved')}</span>}
      </div>
    </div>
  )
}
