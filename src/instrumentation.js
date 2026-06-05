// Next.js instrumentation hook — runs once when the server process boots.
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export function register() {
  // Only register process-level handlers in the Node.js server runtime
  // (not Edge, and not the browser build).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // When a client aborts a multipart/form-data upload partway through, the
  // multipart parser throws "Unexpected end of form" on the request stream's
  // 'end' event — outside any route handler's try/catch — so it surfaces as an
  // unhandled rejection with an internal next-server stack. It's benign (a
  // truncated request body), but it spams the logs. Swallow only that exact
  // case; let every other error through untouched so real problems stay visible.
  const isAbortedUpload = (err) =>
    err instanceof Error && err.message === 'Unexpected end of form'

  process.on('unhandledRejection', (reason) => {
    if (isAbortedUpload(reason)) return
    console.error('Unhandled Rejection:', reason)
  })

  process.on('uncaughtException', (err) => {
    if (isAbortedUpload(err)) return
    console.error('Uncaught Exception:', err)
  })
}
