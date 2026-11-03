/** `@pragma/module-chat/testing` (test code only; the fake UI definition is `./fake-chat-ui.tsx`, used in-module). */

/** The Tasks panel's pure selectors (provider tests check what the panel would show for their events). */
export { taskCounts, taskForest, taskSections } from '../src/renderer/kit/tasks/model'
export * from './fake-chat-capability'
export * from './fake-options'
export * from './support'
export * from './ui-support'
