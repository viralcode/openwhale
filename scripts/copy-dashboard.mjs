// Cross-platform script to copy dashboard assets after tsc build
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist/dashboard', { recursive: true });
copyFileSync('src/dashboard/style.css', 'dist/dashboard/style.css');
copyFileSync('src/dashboard/main.js', 'dist/dashboard/main.js');

console.log('✅ Dashboard assets copied to dist/dashboard/');
