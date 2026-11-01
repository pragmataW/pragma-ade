import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@pragma/ui/components/dialog'
import { AGENTS_TESTIDS } from '../../contract'
import { useAgents } from '../active-worktree'
import { QuietButton } from '../lib/buttons'
import { closeSessionNow } from '../lib/session-actions'
import { getRuntime } from '../runtime'

const cancel = () => getRuntime().store.setState({ closing: null })

/** "Stop this agent?" for closing a running tab. */
export function CloseSessionDialog() {
  const t = useT()
  const closing = useAgents((s) => s.closing)
  return (
    <Dialog open={closing !== null} onOpenChange={(open) => (open ? undefined : cancel())}>
      <DialogContent className="max-w-[420px]">
        <DialogTitle>{t('agents:close.title')}</DialogTitle>
        <DialogDescription>{t('agents:close.body')}</DialogDescription>
        <DialogFooter>
          <QuietButton onClick={cancel}>{t('agents:close.cancel')}</QuietButton>
          <Button
            data-testid={AGENTS_TESTIDS.closeConfirm}
            variant="destructive"
            onClick={() => {
              if (closing) closeSessionNow(closing)
              cancel()
            }}
          >
            {t('agents:close.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
