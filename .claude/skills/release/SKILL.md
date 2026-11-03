---
name: release
description: Cut and publish a new Pragma ADE release with scripts/release.sh — bump the version everywhere, write the CHANGELOG section, build macOS/Linux/Windows, tag, push main and the tag to GitHub, create the GitHub release with all artifacts and SHA256SUMS, and update the Homebrew cask. Use when the user asks to cut, publish, ship or push a new release, bump the version for a release, make a patch/minor/major release, or update the Homebrew tap for a release. Not for ordinary commits or merging feature branches.
---

# Release Pragma ADE

`scripts/release.sh` does the whole release; this skill is how to drive it safely. Read the script's header
(`scripts/release.sh --help`) if anything below is unclear.

## What a release is

- Commit `chore(release): version X.Y.Z` on the integration branch (e.g. `dev/X.Y.Z`): every tracked `package.json`
  on the old version (root, `apps/desktop`, `packages/*`, `modules/*`, `providers/*` and their `packages/*`, including
  `modules/editor/packages/bridge-extension`), `scripts/package/package-lock.json` (top + `packages[""]`), the README
  download links, and a new `CHANGELOG.md` section with its `[X.Y.Z]: …/releases/tag/vX.Y.Z` link reference.
- Annotated tag `vX.Y.Z`, `main` fast-forwarded to the release commit. Only `main` and release tags are ever pushed to
  `git@github.com:pragmataW/pragma-ade.git`.
- GitHub release `vX.Y.Z`, title `Pragma ADE X.Y.Z`, notes = the CHANGELOG section body, marked latest, with 9 assets:
  `pragma-ade-X.Y.Z-mac-{arm64,x64}.{dmg,zip}`, `-linux-amd64.deb`, `-linux-x86_64.AppImage`, `-win-x64-setup.exe`,
  `-win-x64.zip` and `SHA256SUMS.txt`. Linux users download straight from this release.
- `pragmataW/homebrew-tap` `Casks/pragma-ade.rb`: `version` and `sha256 arm:` / `intel:` (of the mac **zip** files;
  the URL uses `#{version}`/`#{arch}` and never changes), commit `pragma-ade X.Y.Z`.

## Procedure

1. **Agree on the version.** Ask the user if they did not say: `patch`, `minor`, `major` or an explicit `X.Y.Z`.
   Check out the integration branch, make sure the tree is clean and the user's feature branches are merged.
2. **Write the release notes** to a file outside the repo (e.g. the scratchpad), unless `CHANGELOG.md` already has a
   `## [X.Y.Z]` or `## [Unreleased]` section. Gather what changed with
   `git log --no-merges --format='%s' $(git describe --tags --abbrev=0)..HEAD` and the merged branches
   (`git log --merges --format=%s …`). House style (copy the newest section of `CHANGELOG.md`):
   - Only `### Added`, `### Changed`, `### Fixed`, in that order, each followed by a blank line; omit empty groups.
   - One `- ` bullet per user-visible change, written for users, not commit subjects. New features lead with a bold
     name: `- **Find in diff:** Cmd/Ctrl+F searches the open file's diff …`. Platform-specific fixes lead with
     `**macOS:**`, `**Linux, Windows:**`. Present tense, no ticket numbers, no internal module names unless the user
     sees them (Git Changes, Local History, Settings › Beta).
   - Wrap lines at 120 columns with a two-space continuation indent. Drop tests, refactors, chores and CI.
   - No `## [X.Y.Z]` heading in the file; the script adds `## [X.Y.Z] - YYYY-MM-DD` and the link reference.
   Show the notes to the user and adjust them before going on.
3. **Dry run first, always:**
   `scripts/release.sh <version> --dry-run --notes-file <notes.md>` (add `--skip-build` when nothing needs building
   for the preview). It runs the preflight, bumps and commits in a throwaway worktree (deleted on exit), prints the
   changed files and commit stat, the SHA256SUMS (placeholders when the artifacts are not built), the planned
   push/release commands and the cask diff. Nothing is tagged, pushed or published. Show the user that plan.
4. **Confirm with the user**, then run for real:
   `scripts/release.sh <version> --notes-file <notes.md> --yes`. Use a long timeout or run it in the background:
   tests plus `pnpm package:all` (macOS natively, Linux in Docker, Windows cross-built) take a long time. Without
   `--yes` it asks before pushing; in a non-interactive shell it then stops, which is fine — rerun with
   `--resume X.Y.Z --skip-build --yes` after the user confirms.
   Pass `--skip-tests` only when the user agrees (e.g. a known environment-only failure); say so in your report.
5. **Verify** (read-only):
   - `gh release view vX.Y.Z --repo pragmataW/pragma-ade --json name,tagName,isLatest,assets -q '.name, .isLatest, (.assets[].name)'`
     shows 9 assets and `SHA256SUMS.txt` matches `dist/release/vX.Y.Z/SHA256SUMS.txt`.
   - `git ls-remote origin main refs/tags/vX.Y.Z` points at the release commit.
   - `brew update && brew info --cask pragmataW/tap/pragma-ade` shows the new version (do not install or upgrade
     unless the user asks).
6. Report the release URL, the version and anything skipped.

## Safety rules

- Never push from the dry run, never force-push, never push anything but `main` (fast-forward) and the release tag.
  Never delete or move a published tag or release; a bad release gets a new patch version.
- Never run the real release without the user's explicit go-ahead for that exact version after they saw the dry run.
- Do not edit the tap by hand; the script updates only `version` and the two `sha256` values.
- Do not add a `Claude-Session:` line to the script; pass extra commit trailers with
  `RELEASE_TRAILER=$'Co-Authored-By: …\nClaude-Session: …'` when your session requires them.

## Resume

If a run stops half-way, fix the cause and rerun with `--resume X.Y.Z` (explicit version, same notes are already in
`CHANGELOG.md`). Add `--skip-build` when `dist/<target>/` already holds the X.Y.Z artifacts. Each step detects what is
done: the release commit (version already bumped), the local tag (must point at HEAD), `main` already at HEAD, the
remote tag (must match), an existing GitHub release (assets are re-uploaded with `--clobber`) and a cask already at
X.Y.Z.

## Troubleshooting

- **Docker is not running**: start Docker Desktop (`open -a Docker`, wait for `docker info`); the Linux build runs in
  Docker. `--skip-build` is only for previews or resumes with artifacts already built.
- **`gh auth status` failed**: ask the user to run `gh auth login` (needs `repo` scope for both repositories).
- **`origin/main` is not an ancestor of HEAD** / not a fast-forward: someone pushed to `main`. Merge `origin/main`
  into the integration branch (never rebase published history, never force), then rerun (or `--resume`).
- **Tag or release already exists**: either the version is wrong (pick the next one) or a previous run stopped;
  use `--resume X.Y.Z`.
- **Missing build artifacts**: `pnpm package:all` exited early or a target failed its audit; read
  `dist/SUMMARY.md`, rebuild one target with `pnpm package:mac|linux|win`, then `--resume X.Y.Z --skip-build`.
- **No notes in a non-interactive shell**: the script writes a draft to `dist/release-notes-X.Y.Z.draft.md`;
  rewrite it in the house style and pass it with `--notes-file`.
- **Tap push rejected**: the cask commit is in a temp clone that is removed on exit; rerun with
  `--resume X.Y.Z --skip-build` — every earlier step is skipped and the cask is updated again.
