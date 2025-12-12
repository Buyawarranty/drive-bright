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
          // Core React - loaded first, minimal
          if (id.includes('node_modules/react-dom')) {
            return 'react-dom';
          }
          if (id.includes('node_modules/react/') && !id.includes('react-router') && !id.includes('react-query') && !id.includes('react-hook-form')) {
            return 'react';
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
          // UI components - split by specific packages for better caching
          if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-popover') || id.includes('@radix-ui/react-dropdown-menu')) {
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
          // Lucide icons - split into smaller chunks
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          // Date utilities
          if (id.includes('date-fns')) {
            return 'date-utils';
          }
          // DnD utilities - admin only
          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }
          // Class utilities - small, load with core
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'utils';
          }
        }
      },
      // Tree shake unused exports more aggressively
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    chunkSizeWarningLimit: 300, // Further reduced for better code splitting
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3, // More passes for better compression
        dead_code: true,
        unused: true
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    cssMinify: 'lightningcss', // Use faster CSS minifier
    cssCodeSplit: true, // Split CSS for faster loading
    modulePreload: {
      polyfill: true // Ensure module preload works across browsers
    },
    sourcemap: false, // Disable sourcemaps in production for smaller builds
    assetsInlineLimit: 4096 // Inline small assets to reduce requests
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none', // Remove comments
    treeShaking: true
  },
}));
