/// <reference types="vite/client" />

declare module 'virtual:kerana-assets' {
  // Rutas relativas a public/assets que existen en el build.
  const files: string[];
  export default files;
}

interface Window {
  __KERANA_READY__?: boolean;
  __KERANA_DEBUG__?: unknown;
  __KERANA_GAME__?: import('phaser').Game;
}
