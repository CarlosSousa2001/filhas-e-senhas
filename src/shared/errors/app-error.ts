export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly exception: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = exception;
  }
}
