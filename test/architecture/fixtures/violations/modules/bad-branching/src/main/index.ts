declare const p: { id: string }
export const isClaude = p.id === 'claude'
export function pick(id: string): number {
  switch (id) {
    case 'claude':
      return 1
    default:
      return 0
  }
}
