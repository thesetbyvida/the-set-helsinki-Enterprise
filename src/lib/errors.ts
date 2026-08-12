export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const preferred = [value.message, value.details, value.hint, value.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);

    if (preferred.length) return preferred.join(" · ");

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown application error";
    }
  }

  return String(error ?? "Unknown application error");
}
