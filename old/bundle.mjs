import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const files = [
  'assets/js/data/products.js',
  'assets/js/modules/ticker.js',
  'assets/js/modules/cart.js',
  'assets/js/modules/shop.js',
  'assets/js/modules/order.js',
  'assets/js/modules/tracking.js',
  'assets/js/modules/navigation.js',
  'assets/js/modules/product.js',
  'assets/js/modules/sliders.js',
  'assets/js/modules/contact.js',
  'assets/js/main.js',
];

let bundled = '';
for (const file of files) {
  const code = readFileSync(resolve(__dirname, file), 'utf-8');
  bundled += `/* ${file} */\n${code}\n\n`;
}

const distDir = resolve(__dirname, 'assets', 'dist');
mkdirSync(distDir, { recursive: true });
writeFileSync(resolve(distDir, 'bundle.js'), bundled);
console.log('Bundle created at assets/dist/bundle.js');
