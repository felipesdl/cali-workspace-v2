import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: process.env.VITE_CALI_PARTNER_OTP_QA_TICKET ? { hmr: false } : undefined,
});
