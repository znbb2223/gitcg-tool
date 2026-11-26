import {defineConfig} from 'vite';
import * as MC from '@motion-canvas/vite-plugin';

const motionCanvas = (MC as any).default?.default ?? (MC as any).default ?? MC;

export default defineConfig({
  plugins: [
    motionCanvas({
      project: ['./project.ts'],
    }),
  ],
  server: {port: 5199, host: '127.0.0.1'},
});
