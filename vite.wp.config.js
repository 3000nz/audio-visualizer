import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'audio-visualizer-wp/assets',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: 'src/main.js', // skip the HTML; PHP template provides the markup
      output: {
        // Fixed filenames so PHP can reference them without hash scanning
        entryFileNames: 'visualizer.js',
        chunkFileNames: 'visualizer-[hash].js',
        assetFileNames: (info) => (info.name?.endsWith('.css') ? 'visualizer.css' : '[name]-[hash][extname]'),
      },
    },
  },
});
