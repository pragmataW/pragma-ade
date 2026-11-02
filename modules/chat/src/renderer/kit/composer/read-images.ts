import { type ChatImage, IMAGE_MEDIA_TYPES, MAX_IMAGE_BYTES } from '../../../contract'

const ACCEPTED = new Set<string>(IMAGE_MEDIA_TYPES)
const DATA_URL_COMMA = ','

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(DATA_URL_COMMA)[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const isImageFile = (f: File): boolean => ACCEPTED.has(f.type)

/** png/jpeg/gif/webp up to 5 MB become chat images; the rest is reported as rejected. */
export async function readImageFiles(files: readonly File[]): Promise<{ images: ChatImage[]; rejected: File[] }> {
  const accepted = files.filter((f) => isImageFile(f) && f.size <= MAX_IMAGE_BYTES)
  const rejected = files.filter((f) => !accepted.includes(f))
  const images = await Promise.all(
    accepted.map(async (f) => ({
      name: f.name,
      mediaType: f.type as ChatImage['mediaType'],
      dataBase64: await toBase64(f),
    })),
  )
  return { images, rejected }
}
