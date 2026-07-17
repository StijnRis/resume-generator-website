export function logRouteError(route: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[API ${route}] Error:`, message);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  } else {
    console.error(error);
  }

  return message;
}
