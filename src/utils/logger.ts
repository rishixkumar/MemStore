type LogLevel = 'log' | 'warn' | 'error';

function emit(level: LogLevel, scope: string, message: string, details?: unknown) {
  const line = `[AmbientMemory:${scope}] ${message}`;

  if (details === undefined) {
    console[level](line);
    return;
  }

  console[level](line, details);
}

export const logger = {
  info(scope: string, message: string, details?: unknown) {
    emit('log', scope, message, details);
  },
  warn(scope: string, message: string, details?: unknown) {
    emit('warn', scope, message, details);
  },
  error(scope: string, message: string, details?: unknown) {
    emit('error', scope, message, details);
  },
};
