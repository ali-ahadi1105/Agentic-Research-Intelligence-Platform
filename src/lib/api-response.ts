/**
 * Standardized API response helpers (per PROJECT.md § 60)
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export function success<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return { success: true, data, meta };
}

export function error(code: string, message: string, field?: string): ApiResponse<never> {
  return { success: false, errors: [{ code, message, field }] };
}

export function notFound(resource: string): ApiResponse<never> {
  return error("NOT_FOUND", `${resource} یافت نشد`);
}

export function unauthorized(): ApiResponse<never> {
  return error("UNAUTHORIZED", "دسترسی غیرمجاز — لطفاً وارد شوید");
}

export function forbidden(): ApiResponse<never> {
  return error("FORBIDDEN", "شما اجازه انجام این عملیات را ندارید");
}

export function badRequest(message: string): ApiResponse<never> {
  return error("BAD_REQUEST", message);
}

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
} as const;
