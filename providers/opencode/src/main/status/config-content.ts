import { PLUGINS_KEY } from './constants'

type Json = Record<string, unknown>

function parseObject(text: string | undefined): Json {
  if (!text) return {}
  try {
    const v: unknown = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {}
  } catch {
    return {}
  }
}

/**
 * `OPENCODE_CONFIG_CONTENT` with our plugin directory added to `plugins` (additive across config documents in 2.x).
 * Every other key of an existing object is kept (a legacy `plugin` key too); invalid JSON → `{"plugins":[dir]}`.
 */
export function mergeOpencodeConfigContent(existing: string | undefined, pluginDir: string): string {
  const doc = parseObject(existing)
  const current = Array.isArray(doc[PLUGINS_KEY]) ? (doc[PLUGINS_KEY] as unknown[]) : []
  return JSON.stringify({ ...doc, [PLUGINS_KEY]: [...new Set([...current, pluginDir])] })
}
