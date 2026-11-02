import { useT } from '@pragma/sdk/renderer'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@pragma/ui/components/dialog'
import { Input } from '@pragma/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { type FormEvent, type ReactNode, useState } from 'react'
import { AGENTS_TESTIDS, agentsIpc, type ProviderInfo, tryParseArgs } from '../../contract'
import { useAgents } from '../active-worktree'
import { ActionButton, QuietButton } from '../lib/buttons'
import { ErrorLine } from '../lib/ErrorLine'
import { useProfileAction } from './profile-action'

const MONO_INPUT = 'font-mono text-[12px]'
const FIELD_LABEL = 'text-[12px] font-medium text-mu'
const SUBMIT = 'submit'
const BUTTON = 'button'

/** Non-seeded providers (custom) first; the first one is preselected. */
const orderProviders = (list: readonly ProviderInfo[]) => [
  ...list.filter((p) => !p.seeded),
  ...list.filter((p) => p.seeded),
]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </div>
  )
}

function NewProfileForm({ onDone }: { onDone(): void }) {
  const t = useT()
  const providers = orderProviders(useAgents((s) => s.providers))
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '')
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const { run, error } = useProfileAction()
  const argsOk = tryParseArgs(args).ok
  const canCreate = providerId !== '' && name.trim() !== '' && command.trim() !== '' && argsOk
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canCreate) return
    const input = { providerId, name: name.trim(), command: command.trim(), args }
    if (await run(agentsIpc.createProfile, input)) onDone()
  }
  const placeholder = providers.find((p) => p.id === providerId)?.defaultCommand ?? ''
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
      <Field label={t('agents:settings.newProfile.provider')}>
        <Select value={providerId} onValueChange={setProviderId}>
          <SelectTrigger data-testid={AGENTS_TESTIDS.newProfileProvider} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {t(p.displayNameKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('agents:settings.newProfile.name')}>
        <Input data-testid={AGENTS_TESTIDS.newProfileName} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('agents:settings.command')}>
        <Input
          data-testid={AGENTS_TESTIDS.newProfileCommand}
          value={command}
          placeholder={placeholder}
          onChange={(e) => setCommand(e.target.value)}
          className={MONO_INPUT}
        />
      </Field>
      <Field label={t('agents:settings.arguments')}>
        <Input
          data-testid={AGENTS_TESTIDS.newProfileArgs}
          value={args}
          aria-invalid={!argsOk}
          onChange={(e) => setArgs(e.target.value)}
          className={MONO_INPUT}
        />
        {argsOk ? null : <span className="text-[11.5px] text-err">{t('agents:errors.argsInvalid')}</span>}
      </Field>
      <ErrorLine text={error} />
      <DialogFooter>
        <QuietButton type={BUTTON} onClick={onDone}>
          {t('agents:settings.newProfile.cancel')}
        </QuietButton>
        <ActionButton type={SUBMIT} data-testid={AGENTS_TESTIDS.newProfileCreate} disabled={!canCreate}>
          {t('agents:settings.newProfile.create')}
        </ActionButton>
      </DialogFooter>
    </form>
  )
}

/** "Add custom agent": provider, name, command and arguments. */
export function NewProfileDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      {open ? (
        <DialogContent
          data-testid={AGENTS_TESTIDS.newProfileDialog}
          aria-describedby={undefined}
          className="sm:max-w-[480px]"
        >
          <DialogHeader>
            <DialogTitle>{t('agents:settings.newProfile.title')}</DialogTitle>
          </DialogHeader>
          <NewProfileForm onDone={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
