import type { OperationResult } from "@venore/plugin-sdk";

export type { OperationResult };

export function ok<T>(data: T): OperationResult<T> {
  return { success: true, data };
}

export function fail<T = never>(code: string, message: string): OperationResult<T> {
  return { success: false, error: { code, message } };
}
