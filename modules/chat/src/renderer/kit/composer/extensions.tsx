import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { FilePlus2, ImagePlus } from '@pragma/ui/icons'
import { useRef } from 'react'
import { AT, ICON_PX, ICON_STROKE, SLASH, VARIANT_GHOST } from '../../../constants'
import {
  CHAT_TESTIDS,
  type ComposerApi,
  type ComposerExtension,
  DOCUMENT_MEDIA_TYPES,
  IMAGE_MEDIA_TYPES,
} from '../../../contract'
import { ComposerAttachments, DocumentChips } from './ComposerAttachments'
import { FileMention } from './FileMention'
import { isDocumentFile, isImageFile, readDocumentFiles, readImageFiles } from './read-images'
import { SlashCommandMenu } from './SlashCommandMenu'

const IMAGE_TOO_LARGE_KEY = 'chat:composer.imageTooLarge'
const DOCUMENT_TOO_LARGE_KEY = 'chat:composer.documentTooLarge'
const IMAGE_ACCEPT = IMAGE_MEDIA_TYPES.join(',')
const DOCUMENT_ACCEPT = DOCUMENT_MEDIA_TYPES.join(',')

/** Reads accepted images into the composer; anything else shows the "too large" notice. */
function attach(files: File[], api: ComposerApi): void {
  void readImageFiles(files).then(({ images, rejected }) => {
    if (images.length > 0) api.addImages(images)
    if (rejected.length > 0) api.notify(IMAGE_TOO_LARGE_KEY)
  })
}

function attachDocuments(files: File[], api: ComposerApi): void {
  void readDocumentFiles(files).then(({ files: read, rejected }) => {
    if (read.length > 0) api.addFiles(read)
    if (rejected.length > 0) api.notify(DOCUMENT_TOO_LARGE_KEY)
  })
}

/** A toolbar icon button over a hidden multi-file input. */
function AttachButton({
  accept,
  labelKey,
  testId,
  icon: Icon,
  onFiles,
}: {
  accept: string
  labelKey: string
  testId: string
  icon: typeof ImagePlus
  onFiles(files: File[]): void
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      <Button
        variant={VARIANT_GHOST}
        size="icon-sm"
        data-testid={testId}
        aria-label={t(labelKey)}
        title={t(labelKey)}
        onClick={() => input.current?.click()}
      >
        <Icon size={ICON_PX} strokeWidth={ICON_STROKE} />
      </Button>
    </>
  )
}

const AttachImageButton = ({ api }: { api: ComposerApi }) => (
  <AttachButton
    accept={IMAGE_ACCEPT}
    labelKey="chat:composer.attachImage"
    testId={CHAT_TESTIDS.attachImage}
    icon={ImagePlus}
    onFiles={(f) => attach(f, api)}
  />
)

const AttachDocumentButton = ({ api }: { api: ComposerApi }) => (
  <AttachButton
    accept={DOCUMENT_ACCEPT}
    labelKey="chat:composer.attachFile"
    testId={CHAT_TESTIDS.attachFile}
    icon={FilePlus2}
    onFiles={(f) => attachDocuments(f, api)}
  />
)

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
    // documents are left to `documentAttachmentsExtension` (listed before this one)
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) => !isDocumentFile(f))
    if (files.length === 0) return false
    attach(files, api)
    return true
  },
}

/**
 * PDF / text attachments (chips above the input). Add it to `composerExtensions` BEFORE the image extension, and only
 * for providers whose `ChatCapability.attachmentKinds` include `pdf` / `text` (the core drops the others).
 */
export const documentAttachmentsExtension: ComposerExtension = {
  id: 'document-attachments',
  toolbar: AttachDocumentButton,
  aboveInput: DocumentChips,
  onPaste(e, api) {
    const files = [...(e.clipboardData?.files ?? [])].filter(isDocumentFile)
    if (files.length === 0) return false
    attachDocuments(files, api)
    return true
  },
  onDrop(e, api) {
    const all = [...(e.dataTransfer?.files ?? [])]
    const docs = all.filter(isDocumentFile)
    if (docs.length > 0) attachDocuments(docs, api)
    // true only when nothing is left for the image extension
    return docs.length > 0 && docs.length === all.length
  },
}

export const defaultComposerExtensions: ComposerExtension[] = [
  slashCommandsExtension,
  fileMentionExtension,
  imageAttachmentsExtension,
]
