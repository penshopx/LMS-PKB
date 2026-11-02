// Never navigate to an arbitrary URL supplied through an authentication link.
export function courseEntryDestination(search = window.location.search): string {
  const next = new URLSearchParams(search).get("next") ?? "";
  return /^\/courses\/[^/?#\\]+$/.test(next) ? next : "/app";
}
