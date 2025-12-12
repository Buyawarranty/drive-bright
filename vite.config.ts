import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      usePolling: false,
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['fsevents'],
    include: ['react', 'react-dom', 'react-router-dom'] // Pre-bundle critical deps
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React - loaded first, keep minimal
          if (id.includes('react-dom')) {
            return 'react-core';
          }
          if (id.includes('node_modules/react/') && !id.includes('react-router') && !id.includes('react-query') && !id.includes('react-hook-form')) {
            return 'react-core';
          }
          // Router - needed for navigation
          if (id.includes('react-router')) {
            return 'router';
          }
          // Supabase - defer as it's heavy
          if (id.includes('@supabase')) {
            return 'supabase';
          }
          // Query library - can be deferred
          if (id.includes('@tanstack/react-query')) {
            return 'query';
          }
          // UI components - split further for tree shaking
          if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-dropdown') || id.includes('@radix-ui/react-popover')) {
            return 'ui-overlays';
          }
          if (id.includes('@radix-ui')) {
            return 'ui-radix';
          }
          // Forms - only needed on specific pages
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'forms';
          }
          // Charts - only on admin
          if (id.includes('recharts')) {
            return 'charts';
          }
          // Lucide icons - split from main bundle
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          // Date utilities
          if (id.includes('date-fns')) {
            return 'date-utils';
          }
          // DND kit - only on admin
          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }
        }
      }
    },
    chunkSizeWarningLimit: 400,
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3,
        ecma: 2020,
        module: true,
        toplevel: true
      },
      mangle: {
        safari10: true,
        toplevel: true
      },
      format: {
        comments: false,
        ecma: 2020
      }
    },
    cssMinify: true,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: true
    },
    sourcemap: false,
    assetsInlineLimit: 4096 // Inline small assets as base64
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
