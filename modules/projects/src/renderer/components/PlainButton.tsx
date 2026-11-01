import type { ComponentProps } from 'react'

/** A native `<button type="button">` (never submits a form). */
export function PlainButton(props: Omit<ComponentProps<'button'>, 'type'>) {
  return <button type="button" {...props} />
}
