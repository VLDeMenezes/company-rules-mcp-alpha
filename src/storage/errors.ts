export type StorageErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'CORRUPT'

/**
 * Domain error raised by the storage layer. Routes map `code` to HTTP status:
 * NOT_FOUND -> 404, CONFLICT -> 409, CORRUPT -> 500.
 */
export class StorageError extends Error {
  readonly code: StorageErrorCode

  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'StorageError'
    this.code = code
  }
}
