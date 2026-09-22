import { defineConfig } from 'vite';

// El sitio se publica en https://juand-1117.github.io/jardin-amarillo/
// por lo que todas las rutas de assets deben colgar de ese subdirectorio.
// En desarrollo la base es '/' para que `vite dev` funcione en la raíz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/jardin-amarillo/' : '/',
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0
  }
}));
