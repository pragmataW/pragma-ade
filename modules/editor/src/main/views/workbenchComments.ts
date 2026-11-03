/**
 * Pragma review threads in the workbench, styled like the app's ThreadView card (comments module): a bordered card,
 * a muted header with icon actions, author pills, a Pending pill, indented replies, a ghost "Reply" button and form
 * buttons that wrap instead of squeezing. Selectors are the DOM of the pinned VSCodium (1.143) comment widget; the
 * files-comments e2e guards them. Colours come only from --vscode-* variables, which the app palette writes
 * (bridge-extension PALETTE_COLOR_MAP), so light, dark and every palette follow the app.
 */
export const WORKBENCH_COMMENTS_CSS = `
/* Card frame: the zone widget's own frame lines go, the head and body form one rounded card. */
.monaco-workbench .review-widget {
  border-width: 0 !important;
  background-color: transparent !important;
  font-family: var(--monaco-font);
}
.monaco-workbench .review-widget > .head,
.monaco-workbench .review-widget > .body {
  margin: 0 12px 0 8px;
  background-color: var(--vscode-editorWidget-background) !important;
  border: 1px solid var(--vscode-panel-border) !important;
}
.monaco-workbench .review-widget > .head {
  box-sizing: border-box;
  align-items: center;
  border-bottom: 0 !important;
  border-radius: 8px 8px 0 0;
  padding: 0 4px 0 12px;
}
.monaco-workbench .review-widget > .body {
  border-top: 0 !important;
  border-radius: 0 0 8px 8px;
  font-size: 13px;
}

/* Head: muted location and status, small icon actions. */
.monaco-workbench .review-widget .head .review-title {
  margin-left: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
.monaco-workbench .review-widget .head .review-actions > .monaco-action-bar .action-label.codicon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--vscode-descriptionForeground);
}
.monaco-workbench .review-widget .head .review-actions > .monaco-action-bar .action-label.codicon:hover {
  color: var(--vscode-foreground);
  background-color: var(--vscode-toolbar-hoverBackground);
}
.monaco-workbench .review-widget .head .review-actions > .monaco-action-bar .action-label.codicon-check:hover {
  color: var(--vscode-pragma-comment-resolvedForeground);
}
.monaco-workbench .review-widget .head .review-actions > .monaco-action-bar .action-label.codicon-trash:hover {
  color: var(--vscode-errorForeground);
}

/* Comments: no avatar column; the root, then replies indented behind a 2px rule. */
.monaco-workbench .review-widget .body .review-comment {
  padding: 8px 12px 4px;
}
.monaco-workbench .review-widget .body .review-comment .avatar-container {
  display: none;
}
.monaco-workbench .review-widget .body .review-comment .review-comment-contents {
  padding-left: 0;
}
.monaco-workbench .review-widget .body .review-comment + .review-comment {
  margin-left: 12px;
  padding: 2px 12px 2px 8px;
  border-left: 2px solid var(--vscode-panel-border);
}
.monaco-workbench .review-widget .body .review-comment + .review-comment .review-comment-contents {
  padding-left: 0;
}
.monaco-workbench .review-widget .body .review-comment .comment-title {
  align-items: center;
  gap: 6px;
}
.monaco-workbench .review-widget .body .review-comment comment-header-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.monaco-workbench .review-widget .body .review-comment .review-comment-contents .author {
  display: inline-flex;
  align-items: center;
  line-height: 16px;
  padding: 0 6px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.monaco-workbench .review-widget .body .review-comment .review-comment-contents .timestamp-container,
.monaco-workbench .review-widget .body .review-comment .review-comment-contents .timestamp {
  margin: 0;
  padding: 0;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}
.monaco-workbench .review-widget .body .review-comment .review-comment-contents .isPending:not(:empty) {
  margin: 0;
  padding: 0 6px;
  line-height: 16px;
  border: 1px solid var(--vscode-pragma-comment-pendingBorder);
  border-radius: 4px;
  font-size: 11px;
  font-style: normal;
}
.monaco-workbench .review-widget .body .review-comment .review-comment-contents .comment-body {
  padding-top: 4px;
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

/* The collapsed reply button: a ghost "↳ Reply", not an input. */
.monaco-workbench .review-widget .body .comment-form-container {
  margin: 4px 12px 8px;
}
.monaco-workbench .review-widget .body .comment-form-container .review-thread-reply-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: auto;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  outline: 0;
  background-color: transparent;
  color: var(--vscode-descriptionForeground);
  font-family: var(--monaco-font);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
}
.monaco-workbench .review-widget .body .comment-form-container .review-thread-reply-button::before {
  content: "\\21B3";
  font-size: 13px;
}
.monaco-workbench .review-widget .body .comment-form-container .review-thread-reply-button:hover,
.monaco-workbench .review-widget .body .comment-form-container .review-thread-reply-button:focus-visible {
  color: var(--vscode-foreground);
  background-color: var(--vscode-toolbar-hoverBackground);
}
.monaco-workbench .review-widget .body .comment-form-container.expand .review-thread-reply-button {
  display: none;
}

/* Comment editor and its buttons: a rounded input, buttons that wrap (primary on the right). */
.monaco-workbench .review-widget .body .comment-form-container .monaco-editor {
  border-radius: 6px;
  outline: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
}
/* The editor's overview ruler (a cursor dash in the corner) is noise in a comment box. */
.monaco-workbench .review-widget .body .comment-form-container .monaco-editor .decorationsOverviewRuler {
  visibility: hidden !important;
}
.monaco-workbench .review-widget .body .comment-form-container .monaco-editor.focused {
  outline-color: var(--vscode-focusBorder);
}
.monaco-workbench .review-widget .body .comment-form-container.expand .form-actions {
  display: flex !important;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin: 8px 0 0;
  overflow: visible;
}
.monaco-workbench .review-widget .body .form-actions .other-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap-reverse;
  justify-content: flex-start;
  gap: 6px;
}
.monaco-workbench .review-widget .body .form-actions .monaco-text-button {
  float: none;
  flex: 0 0 auto;
  width: auto;
  margin: 0 !important;
  padding: 2px 10px;
  border-radius: 6px;
  white-space: nowrap;
  font-family: var(--monaco-font);
  font-size: 12px;
}
`
