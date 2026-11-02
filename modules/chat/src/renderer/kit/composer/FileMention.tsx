import { useEffect, useState } from 'react'
import { AT, MENTION_DEBOUNCE_MS } from '../../../constants'
import type { ComposerMenuProps } from '../../../contract'
import { MenuList } from './MenuList'

/** `@`: worktree files (debounced `searchFiles`); inserts `@<path> `. */
export function FileMention(props: ComposerMenuProps) {
  const { query, api } = props
  const [files, setFiles] = useState<string[]>([])
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      api.session
        .searchFiles(query)
        .then((found) => live && setFiles(found))
        .catch(() => live && setFiles([]))
    }, MENTION_DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [api.session, query])
  return <MenuList items={files.map((f) => ({ key: f, label: f, insert: `${AT}${f} ` }))} props={props} />
}
