import { describe, expect, it } from 'vitest';
import { API_ROUTES } from '@bs/protocol';
import app from './app.js';

/**
 * The route table in `@bs/protocol` is what the OpenAPI document and the
 * technical specification are generated from. If it can drift from the Worker,
 * the documentation is fiction — so it cannot.
 */
describe('the documented API is the API', () => {
  const registered = new Set(
    app.routes
      .filter((route) => route.path.startsWith('/api/') && !route.path.endsWith('*') && route.method !== 'ALL')
      .map((route) => `${route.method} ${route.path}`),
  );

  it('registers every documented route', () => {
    for (const route of API_ROUTES) {
      expect([...registered]).toContain(`${route.method} ${route.path}`);
    }
  });

  it('documents every registered route', () => {
    const documented = new Set(API_ROUTES.map((route) => `${route.method} ${route.path}`));
    for (const route of registered) {
      expect([...documented]).toContain(route);
    }
  });
});
