import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogTitle } from '@pragma/ui/components/dialog'
import { type LucideIcon, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { type CSSProperties, useEffect, useState } from 'react'
import {
  BUTTON_TYPE,
  CODE_KIND,
  MERMAID_LANG,
  MERMAID_STATUS,
  MERMAID_VIEW,
  MERMAID_ZOOM,
  PERCENT,
  SIZE_ICON,
  VARIANT_GHOST,
} from '../../../../constants'
import { CHAT_TESTIDS } from '../../../../contract'
import { useThemeMode } from '../lib/useThemeMode'
import { CODE_BODY, CodeFrame, CopyCodeAction, FRAME_ICON_BUTTON } from './CodeFrame'
import { mermaidThemeVariables, renderMermaid } from './mermaid-render'
import { useThemeVersion } from './use-theme-version'

type MermaidView = (typeof MERMAID_VIEW)[keyof typeof MERMAID_VIEW]
const VIEWS = Object.values(MERMAID_VIEW)

type RenderState =
  | { status: typeof MERMAID_STATUS.pending }
  | { status: typeof MERMAID_STATUS.ready; svg: string }
  | { status: typeof MERMAID_STATUS.failed }
const PENDING: RenderState = { status: MERMAID_STATUS.pending }
const FAILED: RenderState = { status: MERMAID_STATUS.failed }
const DARK = 'dark'
const ZOOM_ORIGIN = 'top center'

/** Renders `code` with Mermaid, again on every theme change; the last good SVG stays up until the next one lands. */
function useMermaidSvg(code: string): RenderState {
  const mode = useThemeMode()
  const version = useThemeVersion()
  const [state, setState] = useState<RenderState>(PENDING)
  useEffect(() => {
    let live = true
    void version
    renderMermaid(code, mermaidThemeVariables(mode === DARK)).then(
      (svg) => live && setState({ status: MERMAID_STATUS.ready, svg }),
      () => live && setState(FAILED),
    )
    return () => {
      live = false
    }
  }, [code, mode, version])
  return state
}

/** Mermaid output, sanitized by Mermaid itself (`securityLevel: 'strict'`, no HTML labels). */
function Svg({
  svg,
  className,
  style,
  testId,
}: {
  svg: string
  className?: string
  style?: CSSProperties
  testId?: string
}) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid's strict-mode SVG (DOMPurify-sanitized)
  return <div data-testid={testId} className={className} style={style} dangerouslySetInnerHTML={{ __html: svg }} />
}

function IconAction({
  label,
  icon: Glyph,
  onClick,
  testId,
}: {
  label: string
  icon: LucideIcon
  onClick(): void
  testId?: string
}) {
  return (
    <Button
      variant={VARIANT_GHOST}
      size={SIZE_ICON}
      data-testid={testId}
      className={FRAME_ICON_BUTTON}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Glyph />
    </Button>
  )
}

function ViewToggle({ view, onChange }: { view: MermaidView; onChange(v: MermaidView): void }) {
  const t = useT()
  return (
    <div
      data-testid={CHAT_TESTIDS.mermaidView}
      className="mr-1 flex h-5 items-center rounded-[5px] border border-bd bg-el p-px"
    >
      {VIEWS.map((v) => (
        <button
          key={v}
          type={BUTTON_TYPE}
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className="h-full rounded-[4px] px-1.5 font-medium text-[10.5px] text-mu transition-colors hover:text-tx aria-pressed:bg-hv aria-pressed:text-tx"
        >
          {t(`chat:markdown.${v}`)}
        </button>
      ))}
    </div>
  )
}

const clampZoom = (z: number): number => Math.min(MERMAID_ZOOM.max, Math.max(MERMAID_ZOOM.min, z))

function ZoomDialog({ svg, onClose }: { svg: string; onClose(): void }) {
  const t = useT()
  const [zoom, setZoom] = useState(1)
  const step = (d: number) => setZoom((z) => clampZoom(z + d))
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid={CHAT_TESTIDS.mermaidDialog}
        className="flex h-[86vh] w-[92vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]"
      >
        <div className="flex h-10 shrink-0 items-center gap-1 border-bd border-b px-3">
          <DialogTitle className="flex-1 font-semibold text-[13px]">{t('chat:markdown.diagram')}</DialogTitle>
          <IconAction label={t('chat:markdown.zoomOut')} icon={Minus} onClick={() => step(-MERMAID_ZOOM.step)} />
          <span className="w-11 text-center text-[11.5px] text-mu tabular-nums">{Math.round(zoom * PERCENT)}%</span>
          <IconAction label={t('chat:markdown.zoomIn')} icon={Plus} onClick={() => step(MERMAID_ZOOM.step)} />
          <IconAction label={t('chat:markdown.zoomReset')} icon={RotateCcw} onClick={() => setZoom(1)} />
          <IconAction label={t('chat:markdown.close')} icon={X} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-bg p-6">
          <Svg
            svg={svg}
            style={{ transform: `scale(${zoom})`, transformOrigin: ZOOM_ORIGIN }}
            className="transition-transform motion-reduce:transition-none [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none!"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A closed ```mermaid fence: the diagram (themed, zoomable) with a Diagram/Source toggle; the source if it fails. */
export function MermaidBlock({ code }: { code: string }) {
  const t = useT()
  const state = useMermaidSvg(code)
  const [view, setView] = useState<MermaidView>(MERMAID_VIEW.diagram)
  const [zoomed, setZoomed] = useState(false)
  const svg = state.status === MERMAID_STATUS.ready ? state.svg : null
  const failed = state.status === MERMAID_STATUS.failed
  const actions = (
    <>
      {svg !== null && <ViewToggle view={view} onChange={setView} />}
      {svg !== null && (
        <IconAction
          testId={CHAT_TESTIDS.mermaidExpand}
          label={t('chat:markdown.expand')}
          icon={Maximize2}
          onClick={() => setZoomed(true)}
        />
      )}
      <CopyCodeAction code={code} label={t('chat:markdown.copySource')} />
    </>
  )
  return (
    <CodeFrame variant={CODE_KIND.mermaid} testId={CHAT_TESTIDS.mermaid} label={MERMAID_LANG} actions={actions}>
      {svg !== null && view === MERMAID_VIEW.diagram ? (
        <Svg
          svg={svg}
          testId={CHAT_TESTIDS.mermaidDiagram}
          className="overflow-x-auto bg-bg p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        />
      ) : (
        <div className={CODE_BODY} data-testid={failed ? CHAT_TESTIDS.mermaidError : undefined}>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      )}
      {failed && (
        <p className="border-bd border-t px-3 py-1.5 text-[11.5px] text-warn">{t('chat:markdown.renderFailed')}</p>
      )}
      {zoomed && svg !== null && <ZoomDialog svg={svg} onClose={() => setZoomed(false)} />}
    </CodeFrame>
  )
}
