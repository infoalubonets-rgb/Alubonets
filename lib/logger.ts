type LogContext = Record<string, unknown>

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }
  }
  return { message: String(error) }
}

export function logInfo(event: string, context: LogContext = {}) {
  console.info(JSON.stringify({
    level: 'info',
    event,
    timestamp: new Date().toISOString(),
    ...context,
  }))
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
  console.error(JSON.stringify({
    level: 'error',
    event,
    timestamp: new Date().toISOString(),
    error: serializeError(error),
    ...context,
  }))
}
