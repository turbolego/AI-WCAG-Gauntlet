import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

try {
    execFileSync('powershell', [
        '-NoProfile', '-NonInteractive', '-File',
        fileURLToPath(new URL('./check-syntax.ps1', import.meta.url)),
        ...process.argv.slice(2)
    ], { stdio: 'inherit' });
} catch (error) {
    process.exitCode = error.status ?? 1;
}