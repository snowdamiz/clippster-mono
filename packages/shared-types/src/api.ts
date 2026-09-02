export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
  [key: string]: unknown;
}

export interface ApiError {
  success: false;
  error?: string;
  code?: string;
  [key: string]: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
