import { useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { useEffect, useState } from 'react'
import { SEARCH_DEBOUNCE_MS } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { useDebouncedValue } from '../lib/use-debounced-value'
import { setFilter, useBoardStore } from '../store'

/** Title / description / key search, debounced into the store filter (remounted by Clear: `filterVersion`). */
export function SearchInput() {
  const t = useT()
  const stored = useBoardStore((s) => s.filter.query)
  const [query, setQuery] = useState(stored)
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  // Store sync: the store is the external system shared with Clear.
  useEffect(() => setFilter({ query: debounced }), [debounced])
  return (
    <Input
      data-testid={T.search}
      value={query}
      placeholder={t('board:search.placeholder')}
      aria-label={t('board:search.placeholder')}
      onChange={(e) => setQuery(e.target.value)}
      className="w-48"
    />
  )
}
