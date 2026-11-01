import { Button, type ButtonProps } from '@pragma/ui/components/button'
import type { ComponentProps } from 'react'

const SMALL = 'sm'
const ICON_SMALL = 'icon-sm'
const GHOST = 'ghost'

/** Compact primary action (dialog footers, notices). */
export const ActionButton = (props: ButtonProps) => <Button size={SMALL} {...props} />
/** Compact secondary action. */
export const QuietButton = (props: ButtonProps) => <Button size={SMALL} variant={GHOST} {...props} />
/** Icon-only secondary action. */
export const IconButton = (props: ButtonProps) => <Button size={ICON_SMALL} variant={GHOST} {...props} />
/** A plain `<button type="button">` (tab strip controls). */
export const PlainButton = (props: ComponentProps<'button'>) => <button type="button" {...props} />
