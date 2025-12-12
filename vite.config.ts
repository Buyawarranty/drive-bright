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
          // Core React - loaded first
          if (id.includes('react-dom') || (id.includes('react') && !id.includes('react-router') && !id.includes('react-query') && !id.includes('react-hook-form'))) {
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
          // UI components - split by usage
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
          // Lucide icons - frequently used
          if (id.includes('lucide-react')) {
            return 'icons';
          }
        }
      }
    },
    chunkSizeWarningLimit: 500, // Reduced for better code splitting
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: {
        safari10: true
      }
    },
    cssMinify: true,
    cssCodeSplit: true, // Split CSS for faster loading
    modulePreload: {
      polyfill: true // Ensure module preload works across browsers
    },
    sourcemap: false // Disable sourcemaps in production for smaller builds
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
