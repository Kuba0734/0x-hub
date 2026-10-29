/** Direction from the order of two routes in the navigation: +1 forward, -1 back. */
export function routeDirection(order: readonly string[], from: string, to: string): number {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a === -1 || b === -1 || a === b) return 1;
  return b > a ? 1 : -1;
}
