import { useEffect, useState } from 'react'
import { useChatHost } from '../../../host-adapter'

/** Bumps on every theme change (mode or palette), for renderers that bake colours in (Mermaid SVG). */
export function useThemeVersion(): number {
  const { theme } = useChatHost()
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const sub = theme.subscribe(() => setVersion((v) => v + 1))
    return () => sub.dispose()
  }, [theme])
  return version
}
