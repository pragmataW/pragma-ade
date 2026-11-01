import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { AGENTS_IPC as C, AGENTS_IPC_EVENTS as E } from './constants'
import { commandResolutionSchema, profileCheckSchema } from './launch'
import { agentProfileSchema, createProfileInputSchema, providerInfoSchema, updateProfilePatchSchema } from './profiles'
import {
  agentSessionSchema,
  newWorktreeDefaultsSchema,
  relaunchOptionsSchema,
  startSessionInputSchema,
} from './sessions'

const none = z.void()
const idRef = z.object({ id: z.string().min(1) })
const worktreeRef = z.object({ worktreeId: z.string().min(1) })
const profiles = z.array(agentProfileSchema)

/** Renderer → main requests (`agents.*`). Failures reject with an `AgentsError` message (see `agentsErrorKey`). */
export const agentsIpc = {
  listProviders: defineIpc({ channel: C.listProviders, input: none, output: z.array(providerInfoSchema) }),
  listProfiles: defineIpc({
    channel: C.listProfiles,
    input: z.object({ launchableOnly: z.boolean().optional() }).optional(),
    output: profiles,
  }),
  createProfile: defineIpc({ channel: C.createProfile, input: createProfileInputSchema, output: agentProfileSchema }),
  updateProfile: defineIpc({
    channel: C.updateProfile,
    input: idRef.extend({ patch: updateProfilePatchSchema }),
    output: agentProfileSchema,
  }),
  resetProfile: defineIpc({ channel: C.resetProfile, input: idRef, output: agentProfileSchema }),
  setDefaultProfile: defineIpc({ channel: C.setDefaultProfile, input: idRef, output: none }),
  deleteProfile: defineIpc({ channel: C.deleteProfile, input: idRef, output: none }),
  resolveCommand: defineIpc({
    channel: C.resolveCommand,
    input: z.object({ command: z.string() }),
    output: commandResolutionSchema,
  }),
  checkProfile: defineIpc({ channel: C.checkProfile, input: idRef, output: profileCheckSchema }),
  listModes: defineIpc({ channel: C.listModes, input: none, output: z.array(z.string()) }),
  startSession: defineIpc({ channel: C.startSession, input: startSessionInputSchema, output: agentSessionSchema }),
  relaunchSession: defineIpc({
    channel: C.relaunchSession,
    input: idRef.extend(relaunchOptionsSchema.shape),
    output: agentSessionSchema,
  }),
  listSessions: defineIpc({ channel: C.listSessions, input: worktreeRef, output: z.array(agentSessionSchema) }),
  getSession: defineIpc({ channel: C.getSession, input: idRef, output: agentSessionSchema.nullable() }),
  stopSession: defineIpc({ channel: C.stopSession, input: idRef, output: none }),
  closeSession: defineIpc({ channel: C.closeSession, input: idRef, output: none }),
  focusSession: defineIpc({ channel: C.focusSession, input: idRef, output: none }),
  newWorktreeDefaults: defineIpc({
    channel: C.newWorktreeDefaults,
    input: worktreeRef,
    output: newWorktreeDefaultsSchema,
  }),
} as const

export const profilesChangedPayloadSchema = z.object({ profiles })
export const sessionChangedPayloadSchema = z.object({ session: agentSessionSchema, reveal: z.boolean() })
export type SessionChangedPayload = z.infer<typeof sessionChangedPayloadSchema>

/** Main → renderer events (`ctx.ipc.publish`). */
export const agentsIpcEvents = {
  profilesChanged: defineIpcEvent({ channel: E.profilesChanged, payload: profilesChangedPayloadSchema }),
  sessionChanged: defineIpcEvent({ channel: E.sessionChanged, payload: sessionChangedPayloadSchema }),
} as const
