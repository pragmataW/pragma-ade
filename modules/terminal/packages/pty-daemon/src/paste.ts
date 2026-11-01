import { CARRIAGE_RETURN, PASTE_END, PASTE_NEWLINE_RE, PASTE_START } from './constants'

/**
 * Encodes pasted text the way a terminal sends it: line ends become CR, and when the program enabled
 * bracketed paste (mode 2004) the text is wrapped in the paste markers. Markers inside the text are removed so
 * a paste cannot end the bracket early and smuggle keystrokes in.
 */
export function encodePaste(text: string, bracketed: boolean): string {
  const body = text.replaceAll(PASTE_START, '').replaceAll(PASTE_END, '').replace(PASTE_NEWLINE_RE, CARRIAGE_RETURN)
  return bracketed ? `${PASTE_START}${body}${PASTE_END}` : body
}
