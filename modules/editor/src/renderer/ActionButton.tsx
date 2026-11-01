import { Button } from '@pragma/ui/components/button'
import type { ReactNode } from 'react'

const SIZE = 'sm'
const SECONDARY = 'outline'

/** The compact button of the Files tab and the settings page (ui-notes: 24–30px controls). */
export function ActionButton(p: { testId: string; secondary?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <Button size={SIZE} variant={p.secondary ? SECONDARY : undefined} data-testid={p.testId} onClick={p.onClick}>
      {p.children}
    </Button>
  )
}
