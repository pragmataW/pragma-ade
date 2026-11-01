import type { ComponentProps } from 'react'
import { BUTTON_TYPES } from '../../constants'

/** A native `<button type="button">` (never submits a form). */
export function PlainButton(props: Omit<ComponentProps<'button'>, 'type'>) {
  return <button type={BUTTON_TYPES.button} {...props} />
}
