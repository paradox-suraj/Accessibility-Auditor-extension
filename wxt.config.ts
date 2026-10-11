import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Accessibility & Security Auditor',
    description: 'Automated WCAG 2.2 accessibility and OWASP security auditor with in-page highlighting and local IndexedDB history',
    version: '1.0.0',
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    permissions: [
      'activeTab',
      'tabs',
      'scripting',
      'storage',
      'sidePanel',
      'cookies',
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none';",
    },
    host_permissions: [
      '<all_urls>',
    ],
    action: {
      default_title: 'Open Accessibility Auditor',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
