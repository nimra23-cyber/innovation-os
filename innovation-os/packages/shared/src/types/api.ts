export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorDetail {
  message: string;
  code?: string;
  fields?: Record<string, string>;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export function isApiError(result: unknown): result is ApiErrorResponse {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as ApiErrorResponse).error === 'object'
  );
}
