import { copyFile, mkdir, readFile } from 'node:fs/promises';
const source = new URL('../node_modules/three/', import.meta.url);
const target = new URL('../assets/vendor/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ['three.module.js', 'three.core.js']) await copyFile(new URL(`build/${file}`, source), new URL(file, target));
await copyFile(new URL('LICENSE', source), new URL('LICENSE', target));
const { version } = JSON.parse(await readFile(new URL('package.json', source), 'utf8'));
console.log(`Three.js ${version}: módulos e licença copiados para assets/vendor/.`);
