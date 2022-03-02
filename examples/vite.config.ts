import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import shadowDomCssPlugin from '../src/index';
import Inspect from 'vite-plugin-inspect'

const cwd = process.cwd();
const { name, main, } = JSON.parse(fs.readFileSync(`${cwd}/package.json`, 'utf8'));

const filename = name.replace(/^@[^/]+\//, '').replace(/\//g, '-');
const outDir = `dist`;


// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir,
    lib: {
      entry: path.resolve(cwd, main),
      formats: ['es', 'system'],
      fileName: format => `${filename}.${format}.js`,
    }
  },
  plugins: [
    shadowDomCssPlugin(),
    createVuePlugin(),
    Inspect()
  ],
});
