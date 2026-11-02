import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pragma/ui/components/dialog'
import { useState } from 'react'
import { CLI_TESTIDS, SKILL_STATE, type SkillTargetStatus } from '../contract'

const SMALL = 'sm'
const GHOST = 'ghost'

/** Providers in first-seen order with their targets. */
function byProvider(targets: SkillTargetStatus[]): { id: string; nameKey: string; targets: SkillTargetStatus[] }[] {
  const groups = new Map<string, { id: string; nameKey: string; targets: SkillTargetStatus[] }>()
  for (const t of targets) {
    const g = groups.get(t.providerId) ?? { id: t.providerId, nameKey: t.providerDisplayNameKey, targets: [] }
    g.targets.push(t)
    groups.set(t.providerId, g)
  }
  return [...groups.values()]
}

const needsWrite = (targets: SkillTargetStatus[]): string[] => [
  ...new Set(targets.filter((t) => t.state !== SKILL_STATE.current).map((t) => t.providerId)),
]

function TargetDirs({ targets }: { targets: SkillTargetStatus[] }) {
  const t = useT()
  return (
    <ul className="ml-6 flex flex-col gap-0.5">
      {targets.map((s) => (
        <li key={s.dir} className="flex items-baseline gap-2 text-[11.5px] text-mu">
          <span data-testid={CLI_TESTIDS.skillsDialogDir} className="[font-family:var(--font-code)] break-all">
            {s.dir}
          </span>
          {s.state === SKILL_STATE.foreign ? (
            <span className="shrink-0 text-err">{t('cli-integration:dialog.skills.replaces')}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function DialogBody(p: { targets: SkillTargetStatus[]; onCancel(): void; onConfirm(providerIds: string[]): void }) {
  const t = useT()
  const [chosen, setChosen] = useState<string[]>(() => needsWrite(p.targets))
  const toggle = (id: string, on: boolean) => setChosen((c) => (on ? [...c, id] : c.filter((x) => x !== id)))
  return (
    <>
      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
        {byProvider(p.targets).map((g) => (
          <div key={g.id} className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-[13px] text-tx">
              <input
                type="checkbox"
                data-testid={CLI_TESTIDS.skillsDialogProvider(g.id)}
                checked={chosen.includes(g.id)}
                onChange={(e) => toggle(g.id, e.target.checked)}
              />
              {t(g.nameKey)}
            </label>
            {chosen.includes(g.id) ? <TargetDirs targets={g.targets} /> : null}
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button size={SMALL} variant={GHOST} data-testid={CLI_TESTIDS.skillsCancelButton} onClick={p.onCancel}>
          {t('cli-integration:dialog.skills.cancel')}
        </Button>
        <Button
          size={SMALL}
          data-testid={CLI_TESTIDS.skillsConfirmButton}
          disabled={chosen.length === 0}
          onClick={() => p.onConfirm(chosen)}
        >
          {t('cli-integration:dialog.skills.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Consent step before writing skills: every directory that will be written, foreign ones marked as replaced. */
export function SkillInstallDialog(p: {
  open: boolean
  targets: SkillTargetStatus[]
  onCancel(): void
  onConfirm(providerIds: string[]): void
}) {
  const t = useT()
  return (
    <Dialog open={p.open} onOpenChange={(o) => (o ? undefined : p.onCancel())}>
      {p.open ? (
        <DialogContent data-testid={CLI_TESTIDS.skillsDialog} className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('cli-integration:dialog.skills.title')}</DialogTitle>
            <DialogDescription>{t('cli-integration:dialog.skills.body')}</DialogDescription>
          </DialogHeader>
          <DialogBody targets={p.targets} onCancel={p.onCancel} onConfirm={p.onConfirm} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
