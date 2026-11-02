# Local history

IntelliJ-style safety net for destructive git operations. Before Git Changes discards files or hunks, deletes
untracked files, drops stashes or undoes a commit, this module saves what is about to be lost; the Local History tab
restores it. Entries expire after `retentionDays` (default 7) and the store is capped at `maxTotalMb`.
