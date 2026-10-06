const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function safeDiagnostic(
  operation: 'request' | 'configuration',
  error: unknown,
  correlationId: string
) {
  return {
    operation,
    kind:
      error instanceof Error && error.name === 'ConfigError'
        ? 'configuration'
        : 'unexpected',
    correlationId: uuidPattern.test(correlationId) ? correlationId : undefined
  };
}
export function safeError(correlationId: string): {
  message: string;
  correlationId?: string;
} {
  return {
    message: 'Something went wrong. Please try again.',
    correlationId: uuidPattern.test(correlationId) ? correlationId : undefined
  };
}
