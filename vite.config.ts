import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public', 'assets');
const VIRTUAL_ID = 'virtual:kerana-assets';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// Lista los archivos de public/assets para no pedir assets inexistentes (evita 404 en consola).
function listAssets(dir: string): string[] {
  let out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(listAssets(full));
    else out.push(relative(ASSETS_DIR, full).split(sep).join('/'));
  }
  return out;
}

function keranaAssets(): Plugin {
  return {
    name: 'kerana-assets',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(listAssets(ASSETS_DIR))};`;
    },
    configureServer(server) {
      // En dev, si cambia public/assets se recarga la lista.
      server.watcher.add(ASSETS_DIR);
      const invalidate = (file: string) => {
        if (!file.startsWith(ASSETS_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on('add', invalidate);
      server.watcher.on('unlink', invalidate);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [keranaAssets()],
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
