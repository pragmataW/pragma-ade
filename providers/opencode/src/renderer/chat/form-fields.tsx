import { useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { RadioGroup, RadioGroupItem } from '@pragma/ui/components/radio-group'
import { Switch } from '@pragma/ui/components/switch'
import { useId } from 'react'
import { CUSTOM_CHOICE, FORM_I18N, OPENCODE_CHAT_TESTIDS as IDS } from './constants'
import { type FormField, type FormValue, FORM_FIELD_TYPE as T } from './payloads'

export interface FieldProps {
  field: FormField
  value: FormValue | undefined
  onChange(v: FormValue | undefined): void
  disabled: boolean
}

const OPTION_ROW = 'flex items-center gap-2 text-[12.5px] text-tx'

/** Radio options (+ "Other…" free text when `custom`). */
function ChoiceField({ field, value, onChange, disabled }: FieldProps) {
  const t = useT()
  const id = useId()
  const idOf = (v: string) => `${id}-${v}`
  const options = field.options ?? []
  const isOption = options.some((o) => o.value === value)
  const custom = value !== undefined && !isOption
  const radio = custom ? CUSTOM_CHOICE : typeof value === 'string' ? value : ''
  return (
    <div className="flex flex-col gap-1.5">
      <RadioGroup
        value={radio}
        disabled={disabled}
        onValueChange={(v) => onChange(v === CUSTOM_CHOICE ? '' : v)}
        className="gap-1.5"
      >
        {options.map((o) => (
          <div key={o.value} className={OPTION_ROW}>
            <RadioGroupItem id={idOf(o.value)} value={o.value} data-testid={IDS.formOption(field.key, o.value)} />
            <label htmlFor={idOf(o.value)}>{o.label}</label>
            {o.description ? <span className="text-mu">{o.description}</span> : null}
          </div>
        ))}
        {field.custom ? (
          <div className={OPTION_ROW}>
            <RadioGroupItem
              id={idOf(CUSTOM_CHOICE)}
              value={CUSTOM_CHOICE}
              data-testid={IDS.formOption(field.key, CUSTOM_CHOICE)}
            />
            <label htmlFor={idOf(CUSTOM_CHOICE)}>{t(FORM_I18N.custom)}</label>
          </div>
        ) : null}
      </RadioGroup>
      {custom ? (
        <Input
          data-testid={IDS.formCustom(field.key)}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  )
}

function TextField({ field, value, onChange, disabled }: FieldProps) {
  const numeric = field.type === T.number || field.type === T.integer
  return (
    <Input
      data-testid={IDS.formField(field.key)}
      type={numeric ? 'number' : 'text'}
      value={value === undefined ? '' : String(value)}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value
        if (!numeric) return onChange(raw)
        onChange(raw === '' ? undefined : Number(raw))
      }}
    />
  )
}

function BooleanField({ field, value, onChange, disabled }: FieldProps) {
  return (
    <Switch
      data-testid={IDS.formField(field.key)}
      checked={value === true}
      disabled={disabled}
      onCheckedChange={(v) => onChange(v)}
    />
  )
}

function MultiField({ field, value, onChange, disabled }: FieldProps) {
  const picked = Array.isArray(value) ? value : []
  const toggle = (v: string, on: boolean) => onChange(on ? [...picked, v] : picked.filter((x) => x !== v))
  return (
    <div className="flex flex-col gap-1.5">
      {(field.options ?? []).map((o) => (
        <label key={o.value} className={OPTION_ROW}>
          <input
            type="checkbox"
            data-testid={IDS.formOption(field.key, o.value)}
            checked={picked.includes(o.value)}
            disabled={disabled}
            onChange={(e) => toggle(o.value, e.target.checked)}
            className="size-3.5 accent-[var(--color-ac)]"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/** The input for one form field (field titles and options are data; `external` fields are not answerable here). */
export function FormFieldInput(props: FieldProps) {
  switch (props.field.type) {
    case T.string:
      return props.field.options?.length ? <ChoiceField {...props} /> : <TextField {...props} />
    case T.number:
    case T.integer:
      return <TextField {...props} />
    case T.boolean:
      return <BooleanField {...props} />
    case T.multiselect:
      return <MultiField {...props} />
    case T.external:
      return null
    default: {
      const never: never = props.field.type
      return never
    }
  }
}

/** The initial value of a field: its `default`, or `false` for a boolean. */
export function initialValue(field: FormField): FormValue | undefined {
  const d = field.default
  if (typeof d === 'string' || typeof d === 'number' || typeof d === 'boolean') return d
  if (Array.isArray(d) && d.every((x) => typeof x === 'string')) return d
  return field.type === T.boolean ? false : undefined
}
