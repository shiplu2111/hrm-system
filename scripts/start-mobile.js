/**
 * Starts Expo in its own terminal so the interactive QR / dev menu works.
 * `concurrently` pipes stdout and breaks Expo's TUI.
 */
const { spawn } = require('child_process');
const path = require('path');

const mobileDir = path.resolve(__dirname, '../apps/mobile');
const isWin = process.platform === 'win32';

if (isWin) {
  spawn('cmd', ['/c', 'start', 'cmd', '/k', 'npm run dev:mobile'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'ignore',
    detached: true,
  }).unref();
} else {
  const child = spawn('npm', ['run', 'dev:mobile'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    detached: true,
  });
  child.unref();
}

console.log('[mobile] Opening Expo in a new terminal window…');
console.log('[mobile] Dev tools: http://localhost:8082');
console.log('[mobile] Scan the QR code with Expo Go (Android) or Camera (iOS).');
