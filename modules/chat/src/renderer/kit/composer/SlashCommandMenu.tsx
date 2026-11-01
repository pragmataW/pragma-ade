import { SLASH } from '../../../constants'
import type { ComposerMenuProps } from '../../../contract'
import { MenuList } from './MenuList'

/** `/` at line start: the session's slash commands, filtered by prefix; inserts `/<name> `. */
export function SlashCommandMenu(props: ComposerMenuProps) {
  const q = props.query.toLowerCase()
  const items = props.api.session.transcript.info.commands
    .filter((c) => c.name.toLowerCase().startsWith(q))
    .map((c) => ({
      key: c.name,
      label: `${SLASH}${c.name}`,
      hint: c.argumentHint ? `${c.argumentHint} — ${c.description}` : c.description,
      insert: `${SLASH}${c.name} `,
    }))
  return <MenuList items={items} props={props} />
}
