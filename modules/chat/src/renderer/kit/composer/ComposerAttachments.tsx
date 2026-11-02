import { useT } from '@pragma/sdk/renderer'
import { FileText, X } from '@pragma/ui/icons'
import { BUTTON_TYPE, ICON_PX, ICON_STROKE } from '../../../constants'
import { CHAT_TESTIDS, type ComposerApi } from '../../../contract'

const DATA_URL = (mediaType: string, data: string) => `data:${mediaType};base64,${data}`

/** Thumbnails of the images about to be sent. */
export function ComposerAttachments({ api }: { api: ComposerApi }) {
  const t = useT()
  if (api.images.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 px-2.5 pt-2">
      {api.images.map((img, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: images have no id before sending
          key={i}
          data-testid={CHAT_TESTIDS.attachment}
          className="relative size-12 overflow-hidden rounded-md border border-bd"
        >
          <img src={DATA_URL(img.mediaType, img.dataBase64)} alt={img.name} className="size-full object-cover" />
          <button
            type={BUTTON_TYPE}
            aria-label={t('chat:composer.removeImage')}
            onClick={() => api.removeImage(i)}
            className="absolute top-0.5 right-0.5 rounded-sm bg-el/80 text-mu hover:text-tx"
          >
            <X size={ICON_PX} strokeWidth={ICON_STROKE} />
          </button>
        </span>
      ))}
    </div>
  )
}

/** Chips (icon + name) of the documents about to be sent. */
export function DocumentChips({ api }: { api: ComposerApi }) {
  const t = useT()
  if (api.files.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 px-2.5 pt-2">
      {api.files.map((f, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: files have no id before sending
          key={i}
          data-testid={CHAT_TESTIDS.attachmentFile}
          className="inline-flex h-6 max-w-56 items-center gap-1.5 rounded-sm border border-bd bg-pn pr-1 pl-1.5 text-[12px] text-tx"
        >
          <FileText size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-mu" />
          <span className="min-w-0 truncate">{f.name}</span>
          <button
            type={BUTTON_TYPE}
            aria-label={t('chat:composer.removeFile', { name: f.name })}
            onClick={() => api.removeFile(i)}
            className="rounded-sm text-mu hover:text-tx"
          >
            <X size={ICON_PX} strokeWidth={ICON_STROKE} />
          </button>
        </span>
      ))}
    </div>
  )
}
