import { useT } from '@pragma/sdk/renderer'
import { X } from '@pragma/ui/icons'
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
