import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const tempDir = resolve(rootDir, '.vite-temp', 'tests');

mkdirSync(tempDir, { recursive: true });

// Virtual entry bundling the source modules needed by frontend tests.
const entrySource = `
export { cartReducer, CartProvider, MAX_QTY_PER_OFFER } from '../../src/context/CartContext.tsx';
export { AuthProvider } from '../../src/context/AuthContext.tsx';
export { sanitizeRedirect, formatPrice, formatDateTime } from '../../src/utils/format.ts';
export { OrderKeyCard } from '../../src/components/orders/OrderKeyCard.tsx';
export { CartDrawer } from '../../src/components/CartDrawer.tsx';
export { isFuzzyMatch } from '../../src/components/SearchBar.tsx';
export { default as CartPage } from '../../src/pages/CartPage.tsx';
export { default as AuthPage } from '../../src/pages/AuthPage.tsx';
export { default as CheckoutPage } from '../../src/pages/CheckoutPage.tsx';
export { default as OrdersPage } from '../../src/pages/OrdersPage.tsx';
export { default as OrderDetailPage } from '../../src/pages/OrderDetailPage.tsx';
export { MemoryRouter, Route, Routes } from 'react-router-dom';
`;

const entryPath = resolve(tempDir, 'entry.ts');
const bundlePath = resolve(tempDir, 'bundle.cjs');
writeFileSync(entryPath, entrySource, 'utf8');

const realRrdEntry = realpathSync(resolve(rootDir, 'node_modules/react-router-dom/dist/index.js')).replace(/\\/g, '/');

// Plugin that intercepts Navigate from react-router-dom in SSR tests so we can assert
// exact redirect targets produced by protected routes without needing a browser DOM.
const mockNavigatePlugin = {
  name: 'mock-rrd-navigate',
  setup(b) {
    b.onResolve({ filter: /^react-router-dom$/ }, (args) => {
      if (args.importer.endsWith('rrd-shim.mjs')) return undefined;
      return { path: resolve(tempDir, 'rrd-shim.mjs') };
    });
  },
};

const rrdShim = `
import * as React from 'react';
export * from '${realRrdEntry}';
export function Navigate({ to }) {
  return React.createElement('div', { 'data-redirect-to': typeof to === 'string' ? to : JSON.stringify(to) });
}
`;
writeFileSync(resolve(tempDir, 'rrd-shim.mjs'), rrdShim, 'utf8');

try {
  await build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: bundlePath,
    jsx: 'automatic',
    absWorkingDir: rootDir,
    external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    plugins: [mockNavigatePlugin],
    define: {
      'import.meta.env.VITE_API_URL': '"http://localhost:8080"',
    },
  });

  const res = spawnSync(process.execPath, ['--test', resolve(rootDir, 'tests', 'purchaseFlow.test.mjs')], {
    stdio: 'inherit',
    cwd: rootDir,
  });

  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
} finally {
  rmSync(resolve(rootDir, '.vite-temp'), { recursive: true, force: true });
}
