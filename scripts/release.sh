#!/usr/bin/env bash
# Cut a Pragma ADE release: bump versions, CHANGELOG + README, commit, test, build every platform, SHA256SUMS,
# annotated tag, push main + tag, GitHub release with all assets, Homebrew cask update.
#
# Usage: scripts/release.sh <X.Y.Z|patch|minor|major> [options]
#   --dry-run            do the local steps in a throwaway worktree, print every outward command instead of running it
#   --skip-build         do not run `pnpm package:all`; use the artifacts already in dist/<target>/
#   --skip-tests         do not run `pnpm typecheck && pnpm test`
#   --notes-file <f>     release notes (### Added/Changed/Fixed …) for the new CHANGELOG section
#   --yes                do not ask before pushing and publishing
#   --resume             continue a release that stopped half-way (version already bumped, tag/release may exist)
#   --branch <name>      integration branch the release is cut from (default: the current branch)
#
# Environment (for tests and forks): RELEASE_REMOTE (origin), RELEASE_GH_REPO (pragmataW/pragma-ade),
# RELEASE_TAP_REPO (pragmataW/homebrew-tap), RELEASE_TAP_URL (git@github.com:<tap>.git), RELEASE_GH (gh),
# RELEASE_TRAILER (commit trailer lines), EDITOR.
set -euo pipefail

REMOTE=${RELEASE_REMOTE:-origin}
GH_REPO=${RELEASE_GH_REPO:-pragmataW/pragma-ade}
TAP_REPO=${RELEASE_TAP_REPO:-pragmataW/homebrew-tap}
TAP_URL=${RELEASE_TAP_URL:-git@github.com:${TAP_REPO}.git}
GH=${RELEASE_GH:-gh}
TRAILER=${RELEASE_TRAILER:-"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"}
CASK_FILE=Casks/pragma-ade.rb
MAIN=main
SUMS=SHA256SUMS.txt

DRY=0 SKIP_BUILD=0 SKIP_TESTS=0 YES=0 RESUME=0
SPEC='' NOTES_FILE='' BRANCH=''

usage() { sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; }
log() { printf '\n\033[1m==> %s\033[0m\n' "$*" >&2; }
info() { printf '    %s\n' "$*" >&2; }
warn() { printf '\033[33mwarning:\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[31merror:\033[0m %s\n' "$*" >&2
  exit 1
}
quote() { printf '%q ' "$@"; }
# Local command: always runs (echoed).
run() {
  info "\$ $(quote "$@")"
  "$@"
}
# Outward command (push, publish): printed in --dry-run, run otherwise.
outward() {
  if ((DRY)); then
    printf '    \033[36m[dry-run] would run:\033[0m %s\n' "$(quote "$@")" >&2
  else
    run "$@"
  fi
}
interactive() { [[ -t 0 && -t 1 ]]; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed (needed for: $2)"; }

while (($#)); do
  case $1 in
  --dry-run) DRY=1 ;;
  --skip-build) SKIP_BUILD=1 ;;
  --skip-tests) SKIP_TESTS=1 ;;
  --yes) YES=1 ;;
  --resume) RESUME=1 ;;
  --notes-file)
    [[ $# -ge 2 ]] || die '--notes-file needs a file'
    NOTES_FILE=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
    shift
    ;;
  --branch)
    [[ $# -ge 2 ]] || die '--branch needs a name'
    BRANCH=$2
    shift
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  -*) die "unknown option $1 (see --help)" ;;
  *)
    [[ -z $SPEC ]] || die "unexpected argument $1"
    SPEC=$1
    ;;
  esac
  shift
done
[[ -n $SPEC ]] || {
  usage
  exit 1
}
[[ -z $NOTES_FILE || -f $NOTES_FILE ]] || die "notes file not found: $NOTES_FILE"

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
HELPER=$ROOT/scripts/release/cli.ts
TMP=$(mktemp -d "${TMPDIR:-/tmp}/pragma-release.XXXXXX")
WORK=$ROOT
cleanup() {
  if [[ $WORK != "$ROOT" ]]; then git -C "$ROOT" worktree remove --force "$WORK" >/dev/null 2>&1 || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
# The helper works on the current directory: the repo, or the throwaway worktree in --dry-run.
helper() { (cd "$WORK" && node "$HELPER" "$@"); }
commit_msg() { printf '%s\n\n%s\n' "$1" "$TRAILER"; }
# Commit a remote tag points at (the peeled `^{}` line of an annotated tag), empty when absent.
remote_tag_sha() { git ls-remote "$REMOTE" "refs/tags/$1" "refs/tags/$1^{}" | awk '{s=$1} /\^\{\}$/{p=$1} END{print p ? p : s}'; }

((DRY)) && log 'DRY RUN: nothing is pushed, tagged or published'

# ---------------------------------------------------------------------------------------------------------------------
log '1. Preflight'
need git 'everything'
need node 'the release helper'
need pnpm 'tests and builds'
need "$GH" 'the GitHub release'
need shasum 'SHA256SUMS'
CURRENT_BRANCH=$(git symbolic-ref --quiet --short HEAD) || die 'HEAD is detached; check out the integration branch'
BRANCH=${BRANCH:-$CURRENT_BRANCH}
[[ $CURRENT_BRANCH == "$BRANCH" ]] || die "on $CURRENT_BRANCH, expected the integration branch $BRANCH"
[[ -z $(git status --porcelain) ]] || die 'working tree is not clean; commit or stash first'
info "branch $BRANCH at $(git rev-parse --short HEAD), working tree clean"
"$GH" auth status >/dev/null 2>&1 || die "\`$GH auth status\` failed; run \`gh auth login\`"
info 'gh is authenticated'
if ((!SKIP_BUILD)); then
  need docker 'the Linux build'
  docker info >/dev/null 2>&1 || die 'Docker is not running (needed for the Linux build); start Docker Desktop or pass --skip-build'
  info 'Docker is running'
fi
git fetch --quiet "$REMOTE" "$MAIN" || die "cannot fetch $REMOTE/$MAIN"
git merge-base --is-ancestor "$REMOTE/$MAIN" HEAD ||
  die "$REMOTE/$MAIN is not an ancestor of HEAD: pushing would not be a fast-forward. Merge $REMOTE/$MAIN into $BRANCH first"
info "$REMOTE/$MAIN fast-forwards to HEAD"

CURRENT=$(helper current)
BUMPED=0
if ((RESUME)) && [[ $SPEC == "$CURRENT" ]]; then
  VERSION=$CURRENT BUMPED=1
elif [[ $SPEC == "$CURRENT" ]]; then
  die "the repo is already at $CURRENT; pass --resume $CURRENT to finish that release"
else
  VERSION=$(helper next "$SPEC")
fi
TAG=v$VERSION
info "version $CURRENT -> $VERSION (tag $TAG)$( ((BUMPED)) && echo ', already bumped (resume)')"

LOCAL_TAG=0 REMOTE_TAG=0 RELEASE_EXISTS=0
git rev-parse --quiet --verify "refs/tags/$TAG" >/dev/null && LOCAL_TAG=1
[[ -n $(remote_tag_sha "$TAG") ]] && REMOTE_TAG=1
"$GH" release view "$TAG" --repo "$GH_REPO" >/dev/null 2>&1 && RELEASE_EXISTS=1
if ((!RESUME)) && ((LOCAL_TAG || REMOTE_TAG || RELEASE_EXISTS)); then
  die "$TAG already exists (local tag: $LOCAL_TAG, remote tag: $REMOTE_TAG, release: $RELEASE_EXISTS); pass --resume to continue it"
fi

# ---------------------------------------------------------------------------------------------------------------------
log '2. Release notes'
NOTES=$TMP/notes.md
: >"$NOTES"
if ((BUMPED)) || helper has-section "$VERSION"; then
  [[ -z $NOTES_FILE ]] || die "CHANGELOG.md already has [$VERSION]; drop --notes-file or remove that section"
  info "CHANGELOG.md already has [$VERSION]"
elif [[ -n $NOTES_FILE ]]; then
  cp "$NOTES_FILE" "$NOTES"
  info "notes from $NOTES_FILE"
elif grep -q '^## \[Unreleased\]' CHANGELOG.md; then
  info 'CHANGELOG.md [Unreleased] becomes the release section'
else
  LAST_TAG=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)
  git log --no-merges --format=%s ${LAST_TAG:+"$LAST_TAG"..HEAD} | helper draft >"$NOTES"
  if ((DRY)); then
    warn "no CHANGELOG section for $VERSION; using a draft from commits since ${LAST_TAG:-the start} (a real run needs --notes-file or an editor):"
    sed 's/^/      | /' "$NOTES" >&2
  elif interactive; then
    info "opening a draft from commits since ${LAST_TAG:-the start} in ${EDITOR:-vi}"
    "${EDITOR:-vi}" "$NOTES"
    printf '\n' >&2
    sed 's/^/      | /' "$NOTES" >&2
    read -r -p 'Use these notes? [y/N] ' ok
    [[ $ok == [yY]* ]] || die 'aborted; nothing was changed'
  else
    mkdir -p "$ROOT/dist" && cp "$NOTES" "$ROOT/dist/release-notes-$VERSION.draft.md"
    die "no CHANGELOG.md section for $VERSION and no terminal for \$EDITOR.
  Write the notes (### Added / ### Changed / ### Fixed, CHANGELOG.md house style) to a file and rerun with
  --notes-file <file>. A draft from the commits since ${LAST_TAG:-the start} is in dist/release-notes-$VERSION.draft.md."
  fi
fi

# ---------------------------------------------------------------------------------------------------------------------
log '3. Bump versions, CHANGELOG and README; release commit'
if ((DRY)); then
  WORK=$TMP/worktree
  git worktree add --quiet --detach "$WORK" HEAD
  info "throwaway worktree $WORK (removed on exit; its commit is never referenced by a branch)"
fi
if ((BUMPED)); then
  [[ $(git log -1 --format=%s) == "chore(release): version $VERSION" ]] || warn "HEAD is not the release commit for $VERSION"
  info 'skipped (already bumped)'
else
  info 'changed files:'
  helper bump "$VERSION" | sed 's/^/      /' >&2
  helper has-section "$VERSION" || helper insert-section "$VERSION" "$(date +%F)" "$NOTES"
  git -C "$WORK" add -A
  git -C "$WORK" commit --quiet -m "$(commit_msg "chore(release): version $VERSION")"
  git -C "$WORK" show --stat --format='    commit %h %s' HEAD | sed 's/^/  /' >&2
fi
helper section "$VERSION" >"$TMP/release-notes.md"

# ---------------------------------------------------------------------------------------------------------------------
log '4. Typecheck and tests'
if ((SKIP_TESTS)); then
  info 'skipped (--skip-tests)'
elif ((DRY)); then
  info '[dry-run] would run: pnpm typecheck && pnpm test'
else
  run pnpm typecheck
  run pnpm test
fi

# ---------------------------------------------------------------------------------------------------------------------
log '5. Build all platforms'
if ((SKIP_BUILD)); then
  info 'skipped (--skip-build); using dist/<target>/'
elif ((DRY)); then
  info '[dry-run] would run: pnpm package:all'
else
  run pnpm package:all
fi

# ---------------------------------------------------------------------------------------------------------------------
log "6. Collect assets and $SUMS"
STAGE=$ROOT/dist/release/$TAG
ASSETS=()
MISSING=()
while IFS= read -r rel; do
  if [[ -f $ROOT/$rel ]]; then ASSETS+=("$STAGE/$(basename "$rel")"); else MISSING+=("$rel"); fi
done < <(helper assets "$VERSION")
if ((${#MISSING[@]})); then
  ((DRY)) || die "missing build artifacts: ${MISSING[*]}"
  warn "${#MISSING[@]} artifact(s) not built for $VERSION; using placeholder checksums for the preview"
  SUMS_PATH=$TMP/$SUMS
  helper assets "$VERSION" | while IFS= read -r rel; do
    printf '%064d  %s\n' 0 "$(basename "$rel")"
  done >"$SUMS_PATH"
  ASSETS=()
  while IFS= read -r rel; do ASSETS+=("$STAGE/$(basename "$rel")"); done < <(helper assets "$VERSION")
else
  rm -rf "$STAGE" && mkdir -p "$STAGE"
  while IFS= read -r rel; do cp "$ROOT/$rel" "$STAGE/"; done < <(helper assets "$VERSION")
  (cd "$STAGE" && shasum -a 256 pragma-ade-"$VERSION"-* >"$SUMS")
  SUMS_PATH=$STAGE/$SUMS
fi
ASSETS+=("$STAGE/$SUMS")
sed 's/^/      /' "$SUMS_PATH" >&2

# ---------------------------------------------------------------------------------------------------------------------
log "7. Annotated tag $TAG"
if ((LOCAL_TAG)); then
  [[ $(git rev-parse "$TAG^{commit}") == $(git rev-parse HEAD) ]] || die "local tag $TAG does not point at HEAD"
  info 'exists locally and points at HEAD'
elif ((DRY)); then
  info "[dry-run] would run: git tag -a $TAG -m 'Pragma ADE $VERSION'"
else
  run git tag -a "$TAG" -m "Pragma ADE $VERSION"
fi

# ---------------------------------------------------------------------------------------------------------------------
log 'Plan'
info "push      $(git rev-parse --short HEAD) -> $REMOTE/$MAIN (fast-forward) and $TAG"
info "release   $TAG \"Pragma ADE $VERSION\" on $GH_REPO with ${#ASSETS[@]} assets, notes = CHANGELOG [$VERSION]"
info "homebrew  $TAP_REPO $CASK_FILE -> $VERSION"
if ((!DRY && !YES)); then
  interactive || die 'not a terminal; rerun with --yes to push and publish'
  read -r -p "Push and publish $TAG? [y/N] " ok
  [[ $ok == [yY]* ]] || die "stopped before pushing; the release commit and tag are local. Rerun with --resume $VERSION"
fi

# ---------------------------------------------------------------------------------------------------------------------
log "8. Push $MAIN and $TAG"
git fetch --quiet "$REMOTE" "$MAIN"
if [[ $(git rev-parse "$REMOTE/$MAIN") == $(git rev-parse HEAD) ]] && ((!DRY)); then
  info "$REMOTE/$MAIN is already at HEAD"
else
  git merge-base --is-ancestor "$REMOTE/$MAIN" HEAD || die "$REMOTE/$MAIN moved and is no longer a fast-forward; never force-push"
  outward git push "$REMOTE" "HEAD:refs/heads/$MAIN"
fi
if ((REMOTE_TAG)); then
  [[ $(remote_tag_sha "$TAG") == $(git rev-parse "$TAG^{commit}") ]] || die "remote $TAG points elsewhere"
  info "$REMOTE already has $TAG"
else
  outward git push "$REMOTE" "refs/tags/$TAG"
fi

# ---------------------------------------------------------------------------------------------------------------------
log "9. GitHub release $TAG"
if ((RELEASE_EXISTS)); then
  info 'exists; re-uploading the assets (--clobber)'
  outward "$GH" release upload "$TAG" "${ASSETS[@]}" --repo "$GH_REPO" --clobber
else
  outward "$GH" release create "$TAG" "${ASSETS[@]}" --repo "$GH_REPO" --verify-tag --latest \
    --title "Pragma ADE $VERSION" --notes-file "$TMP/release-notes.md"
fi
info 'release notes:'
sed 's/^/      | /' "$TMP/release-notes.md" | head -n 12 >&2

# ---------------------------------------------------------------------------------------------------------------------
log "10. Homebrew cask ($TAP_REPO)"
TAP=$TMP/tap
if ((DRY)); then
  mkdir -p "$TAP/Casks"
  "$GH" api "repos/$TAP_REPO/contents/$CASK_FILE" -q .content | base64 --decode >"$TAP/$CASK_FILE"
  cp "$TAP/$CASK_FILE" "$TMP/cask.before"
  helper cask "$TAP/$CASK_FILE" "$VERSION" "$SUMS_PATH"
  diff -u "$TMP/cask.before" "$TAP/$CASK_FILE" | sed 's/^/      /' >&2 || true
  outward git clone --depth 1 "$TAP_URL" "$TAP"
  outward git -C "$TAP" commit -am "pragma-ade $VERSION"
  outward git -C "$TAP" push origin HEAD
else
  run git clone --quiet --depth 1 "$TAP_URL" "$TAP"
  helper cask "$TAP/$CASK_FILE" "$VERSION" "$SUMS_PATH"
  if git -C "$TAP" diff --quiet; then
    info "cask is already at $VERSION"
  else
    git -C "$TAP" diff | sed 's/^/      /' >&2
    run git -C "$TAP" commit --quiet -am "$(commit_msg "pragma-ade $VERSION")"
    run git -C "$TAP" push origin HEAD
  fi
fi

log "Done$( ((DRY)) && echo ' (dry run)'): Pragma ADE $VERSION"
((DRY)) || info "check: $GH release view $TAG --repo $GH_REPO; brew update && brew info --cask ${TAP_REPO%/homebrew-tap}/tap/pragma-ade"
