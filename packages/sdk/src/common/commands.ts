import { type ZodType, z } from 'zod'

export interface CommandDef<A> {
  readonly id: string
  readonly args: ZodType<A>
}

export const defineCommand = <A>(c: { id: string; args: ZodType<A> }): CommandDef<A> => c

export const CommandMetaSchema = z.object({ titleKey: z.string().optional(), palette: z.boolean().optional() })
export type CommandMeta = z.infer<typeof CommandMetaSchema>

export const CommandRefSchema = z.object({ id: z.string(), args: z.unknown().optional() })
export type CommandRef = z.infer<typeof CommandRefSchema>

export type CommandHandler<A = unknown, R = unknown> = (args: A) => R | Promise<R>
