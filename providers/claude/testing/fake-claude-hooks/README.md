# fake-claude-hooks

A fake `claude` for status tests (phase 04; reused by 11c). It reads `--settings <file>` and runs the configured
command hooks with Claude-like JSON on stdin (`hook_event_name`, `session_id`, `transcript_path`, `cwd`, plus
`notification_type`, `tool_name`, `source`, `reason` where given).

- Start: runs `SessionStart`. stdin lines: `hook <Event> [notification_type] [tool_name] [field=value…]` (e.g. `hook StopFailure error=rate_limit`), `session <id>` (switch the
  session id, like `/clear`), `transcript <prompt|answer|interrupt|interrupt-tool>` (append that entry to the session
  transcript without running a hook, like Claude does when the user interrupts), `say <text>`, `exit` (runs
  `SessionEnd`, exits 0).
- Every hook input carries `transcript_path`: `<temp dir>/<session id>.jsonl` (a fresh temp dir per run). Control
  characters typed into the terminal (Esc) are dropped from command lines, and Ctrl-C (SIGINT) does not end it.
- `FAKE_CLAUDE_SESSION_ID` sets the session id (default `fake-claude-session`); `FAKE_AGENT_LOG` gets a JSONL `start`
  entry with argv and cwd.
- TS helpers: `providers/claude/testing/fake-claude-hooks.ts` (`fakeClaudeHooksPath`, the env name and default id).
