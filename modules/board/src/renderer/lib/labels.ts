import { MONOGRAM_LETTERS } from '../../constants'

/** A profile's display name: its own name, else the provider's translated name. */
export const profileLabel = (
  t: (key: string) => string,
  p: {
    name?: string | null
    profileName?: string | null
    displayNameKey?: string | null
    profileDisplayNameKey?: string | null
  },
): string => {
  const name = p.name ?? p.profileName
  if (name) return name
  const key = p.displayNameKey ?? p.profileDisplayNameKey
  return key ? t(key) : ''
}

export const monogram = (label: string): string => label.slice(0, MONOGRAM_LETTERS).toUpperCase()
