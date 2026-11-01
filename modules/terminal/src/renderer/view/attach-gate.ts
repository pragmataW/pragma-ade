interface SeqData {
  seq: number
  data: string
}

export interface AttachGate {
  /** Buffers an event that arrived before the snapshot. */
  push(e: SeqData): void
  /** Opens the gate after writing a snapshot that covers everything up to `snapshotSeq`; returns the later data. */
  open(snapshotSeq: number): string[]
  /** After `open`: the data of a new event, or null for one already covered. */
  accept(e: SeqData): string | null
  readonly isOpen: boolean
}

/**
 * Orders live output around a snapshot: a view subscribes first, then fetches the snapshot, so events may arrive
 * before it; anything the snapshot already contains is dropped, nothing after it is lost or doubled.
 */
export function createAttachGate(): AttachGate {
  let buffered: SeqData[] = []
  let last = -1
  let isOpen = false
  const accept = (e: SeqData): string | null => {
    if (e.seq <= last) return null
    last = e.seq
    return e.data
  }
  return {
    push(e) {
      if (isOpen) return
      buffered.push(e)
    },
    open(snapshotSeq) {
      isOpen = true
      last = snapshotSeq
      const out = buffered.map(accept).filter((d): d is string => d !== null)
      buffered = []
      return out
    },
    accept,
    get isOpen() {
      return isOpen
    },
  }
}
