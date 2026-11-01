import { z } from '@pragma/sdk'

export const PROJECTS_ERROR_CODES = [
  'notAGitRepo',
  'bareRepo',
  'pathNotFound',
  'alreadyAdded',
  'projectNotFound',
  'worktreeNotFound',
  'invalidBranchName',
  'branchNotFound',
  'branchCheckedOut',
  'pathExists',
  'cannotRemoveMain',
  'gitNotFound',
  'gitFailed',
  'invalidSettings',
] as const
export type ProjectsErrorCode = (typeof PROJECTS_ERROR_CODES)[number]

/** `PROJECTS_ERROR.notAGitRepo === 'notAGitRepo'`: named access to the codes above (one source). */
export const PROJECTS_ERROR = Object.fromEntries(PROJECTS_ERROR_CODES.map((c) => [c, c])) as {
  readonly [K in ProjectsErrorCode]: K
}

export const ProjectsErrorDtoSchema = z.object({ code: z.enum(PROJECTS_ERROR_CODES), detail: z.string().optional() })
export type ProjectsErrorDto = z.infer<typeof ProjectsErrorDtoSchema>

/** Every expected failure of the projects module; `code` maps to `projects:errors.<code>`. */
export class ProjectsError extends Error {
  readonly code: ProjectsErrorCode
  readonly detail?: string
  constructor(code: ProjectsErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'ProjectsError'
    this.code = code
    if (detail !== undefined) this.detail = detail
  }
}

/** Serializable form of any error; unknown errors become `gitFailed` with their message. */
export function toErrorDto(e: unknown): ProjectsErrorDto {
  if (e instanceof ProjectsError) return e.detail === undefined ? { code: e.code } : { code: e.code, detail: e.detail }
  return { code: PROJECTS_ERROR.gitFailed, detail: e instanceof Error ? e.message : String(e) }
}
