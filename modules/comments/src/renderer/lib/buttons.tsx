import { Button, type ButtonProps } from '@pragma/ui/components/button'

const SMALL = 'sm'
const GHOST = 'ghost'
/** Badge / button variant names shared by the thread view. */
export const OUTLINE = 'outline'
export const SIZE_XS = 'xs'

/** Compact primary action. */
export const PrimaryButton = (props: ButtonProps) => <Button size={SMALL} {...props} />
/** Compact secondary action. */
export const SecondaryButton = (props: ButtonProps) => <Button size={SMALL} variant={OUTLINE} {...props} />
/** Compact quiet action (Cancel). */
export const QuietButton = (props: ButtonProps) => <Button size={SMALL} variant={GHOST} {...props} />
/** Icon-only quiet action. */
export const IconButton = (props: ButtonProps) => <Button size="icon-sm" variant={GHOST} {...props} />
