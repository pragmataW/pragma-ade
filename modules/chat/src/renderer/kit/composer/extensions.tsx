import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ImagePlus } from '@pragma/ui/icons'
import { useRef } from 'react'
import { AT, ICON_PX, ICON_STROKE, SLASH, VARIANT_GHOST } from '../../../constants'
import { CHAT_TESTIDS, type ComposerApi, type ComposerExtension, IMAGE_MEDIA_TYPES } from '../../../contract'
import { ComposerAttachments } from './ComposerAttachments'
import { FileMention } from './FileMention'
import { isImageFile, readImageFiles } from './read-images'
import { SlashCommandMenu } from './SlashCommandMenu'

const IMAGE_TOO_LARGE_KEY = 'chat:composer.imageTooLarge'
const ACCEPT = IMAGE_MEDIA_TYPES.join(',')

/** Reads accepted images into the composer; anything else shows the "too large" notice. */
function attach(files: File[], api: ComposerApi): void {
  void readImageFiles(files).then(({ images, rejected }) => {
    if (images.length > 0) api.addImages(images)
    if (rejected.length > 0) api.notify(IMAGE_TOO_LARGE_KEY)
  })
}

function AttachImageButton({ api }: { api: ComposerApi }) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          attach([...(e.target.files ?? [])], api)
          e.target.value = ''
        }}
      />
      <Button
        variant={VARIANT_GHOST}
        size="icon-sm"
        data-testid={CHAT_TESTIDS.attachImage}
        aria-label={t('chat:composer.attachImage')}
        title={t('chat:composer.attachImage')}
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={ICON_PX} strokeWidth={ICON_STROKE} />
      </Button>
    </>
  )
}

const imageFilesOf = (list: FileList | null | undefined): File[] => [...(list ?? [])].filter(isImageFile)

export const slashCommandsExtension: ComposerExtension = {
  id: 'slash-commands',
  trigger: { char: SLASH, atLineStart: true, menu: SlashCommandMenu },
}

export const fileMentionExtension: ComposerExtension = {
  id: 'file-mention',
  trigger: { char: AT, menu: FileMention },
}

export const imageAttachmentsExtension: ComposerExtension = {
  id: 'image-attachments',
  toolbar: AttachImageButton,
  aboveInput: ComposerAttachments,
  onPaste(e, api) {
    const files = imageFilesOf(e.clipboardData?.files)
    if (files.length === 0) return false
    attach(files, api)
    return true
  },
  onDrop(e, api) {
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length === 0) return false
    attach(files, api)
    return true
  },
}

export const defaultComposerExtensions: ComposerExtension[] = [
  slashCommandsExtension,
  fileMentionExtension,
  imageAttachmentsExtension,
]
