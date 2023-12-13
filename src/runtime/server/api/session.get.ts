import { eventHandler } from 'h3'
import { requireUserSession, sessionHooks } from '../utils/session'

export default eventHandler(async (event) => {
  const session = await requireUserSession(event)

  await sessionHooks.callHookParallel('verify', session, event)

  return session
})
