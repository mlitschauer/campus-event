export interface ErrorDetail {
  field: string
  message: string
}

export function apiError(
  code: string,
  message: string,
  details?: ErrorDetail[],
) {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  }
}