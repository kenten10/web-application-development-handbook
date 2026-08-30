export type RouteModule = { render(): string };
export type RouteLoader = () => Promise<RouteModule>;

export function createRouteLoader(routes: Record<string, RouteLoader>) {
  const cache = new Map<string, Promise<RouteModule>>();
  return async (route: string): Promise<RouteModule> => {
    const loader = routes[route];
    if (!loader) throw new Error(`Unknown route: ${route}`);
    let pending = cache.get(route);
    if (!pending) {
      pending = loader();
      cache.set(route, pending);
    }
    return pending;
  };
}

export const loadRoute = createRouteLoader({
  '/': () => import('./routes/home.js'),
  '/admin': () => import('./routes/admin.js'),
});

export async function navigate(route: string): Promise<string> {
  const started = performance.now();
  const module = await loadRoute(route);
  return `${module.render()} (loaded in ${(performance.now() - started).toFixed(2)} ms)`;
}

export const exerciseId = '8.4';
