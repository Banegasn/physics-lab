import { copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputDirectory = join(process.cwd(), 'dist', 'physics-lab', 'browser');

await copyFile(join(outputDirectory, 'index.html'), join(outputDirectory, '404.html'));
await writeFile(join(outputDirectory, '.nojekyll'), '');
