import manifest from 'material-icon-theme/dist/material-icons.json'

/** The parts of a VS Code icon-theme manifest the lookup reads. */
interface IconMaps {
  fileNames?: Record<string, string>
  fileExtensions?: Record<string, string>
  folderNames?: Record<string, string>
  folderNamesExpanded?: Record<string, string>
}
interface IconManifest extends IconMaps {
  iconDefinitions: Record<string, { iconPath: string }>
  file: string
  folder: string
  folderExpanded: string
  light?: IconMaps
}

const THEME = manifest as unknown as IconManifest
const SEPARATOR = /[\\/]/
const DOT = '.'

const baseName = (path: string): string => (path.split(SEPARATOR).pop() ?? path).toLowerCase()

/** `a.spec.ts` → `spec.ts`, `ts` (longest first, as VS Code matches); a leading dot is part of the name. */
function extensions(name: string): string[] {
  const out: string[] = []
  for (let i = name.indexOf(DOT, 1); i !== -1; i = name.indexOf(DOT, i + 1)) out.push(name.slice(i + 1))
  return out
}

/** The light theme's id wins where it has one (dark-on-light variants). */
function lookup(map: keyof IconMaps, key: string, light: boolean): string | undefined {
  return (light ? THEME.light?.[map]?.[key] : undefined) ?? THEME[map]?.[key]
}

/** Material Icon Theme icon for a file: exact name, then the longest known extension, then the generic file icon. */
export function fileIconName(path: string, o: { light?: boolean } = {}): string {
  const light = o.light === true
  const name = baseName(path)
  const byName = lookup('fileNames', name, light)
  if (byName) return byName
  for (const ext of extensions(name)) {
    const byExt = lookup('fileExtensions', ext, light)
    if (byExt) return byExt
  }
  return THEME.file
}

/** Material Icon Theme icon for a folder by its name, open or closed. */
export function folderIconName(path: string, o: { open?: boolean; light?: boolean } = {}): string {
  const light = o.light === true
  const name = baseName(path)
  const named = lookup(o.open ? 'folderNamesExpanded' : 'folderNames', name, light)
  return named ?? (o.open ? THEME.folderExpanded : THEME.folder)
}

/** The SVG file name (`typescript.svg`) of an icon id. */
export function iconFileName(icon: string): string | undefined {
  return THEME.iconDefinitions[icon]?.iconPath.split(SEPARATOR).pop()
}
