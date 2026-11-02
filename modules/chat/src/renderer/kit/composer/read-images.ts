import {
  type ChatFile,
  type ChatImage,
  DOCUMENT_MEDIA_TYPES,
  IMAGE_MEDIA_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
} from '../../../contract'

const ACCEPTED = new Set<string>(IMAGE_MEDIA_TYPES)
const DOCUMENTS = new Set<string>(DOCUMENT_MEDIA_TYPES)
const DATA_URL_COMMA = ','

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(DATA_URL_COMMA)[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const isImageFile = (f: File): boolean => ACCEPTED.has(f.type)
export const isDocumentFile = (f: File): boolean => DOCUMENTS.has(f.type)

/** Files that pass `accept` within `maxBytes`, read as base64; the rest is reported as rejected. */
async function readAccepted<M extends string>(
  files: readonly File[],
  accept: (f: File) => boolean,
  maxBytes: number,
): Promise<{ read: { name: string; mediaType: M; dataBase64: string }[]; rejected: File[] }> {
  const accepted = files.filter((f) => accept(f) && f.size <= maxBytes)
  const rejected = files.filter((f) => !accepted.includes(f))
  const read = await Promise.all(
    accepted.map(async (f) => ({ name: f.name, mediaType: f.type as M, dataBase64: await toBase64(f) })),
  )
  return { read, rejected }
}

/** png/jpeg/gif/webp up to 5 MB become chat images; the rest is reported as rejected. */
export async function readImageFiles(files: readonly File[]): Promise<{ images: ChatImage[]; rejected: File[] }> {
  const { read, rejected } = await readAccepted<ChatImage['mediaType']>(files, isImageFile, MAX_IMAGE_BYTES)
  return { images: read, rejected }
}

/** PDF and text documents up to 10 MB become chat files; the rest is reported as rejected. */
export async function readDocumentFiles(files: readonly File[]): Promise<{ files: ChatFile[]; rejected: File[] }> {
  const { read, rejected } = await readAccepted<ChatFile['mediaType']>(files, isDocumentFile, MAX_DOCUMENT_BYTES)
  return { files: read, rejected }
}
