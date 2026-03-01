import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../artifacts/contracts');
const destDir = path.join(__dirname, '../frontend/src/artifacts/contracts');

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }

    const items = fs.readdirSync(from);

    for (const item of items) {
        const srcPath = path.join(from, item);
        const destPath = path.join(to, item);

        if (fs.lstatSync(srcPath).isDirectory()) {
            copyFolderSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

copyFolderSync(srcDir, destDir);
console.log('Artifacts copied to frontend.');
