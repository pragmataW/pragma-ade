import { Badge } from '@pragma/ui/components/badge'
import { MessageSquare } from '@pragma/ui/icons'
import { IconButton } from '../lib/buttons'

const ICON_PX = 15

/** The session toolbar's comments button: icon plus a draft-count badge. */
export function CommentsIconButton(props: { count: number; label: string; testId: string; onClick(): void }) {
  return (
    <IconButton
      data-testid={props.testId}
      data-count={props.count}
      aria-label={props.label}
      title={props.label}
      className="relative"
      onClick={props.onClick}
    >
      <MessageSquare size={ICON_PX} aria-hidden />
      {props.count > 0 ? (
        <Badge className="-top-1 -right-1 absolute h-4 min-w-4 rounded-full px-1 text-[10px] leading-none">
          {props.count}
        </Badge>
      ) : null}
    </IconButton>
  )
}
