import { spawn } from 'node:child_process';
import electronPath from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electron = spawn(electronPath, ['.'], { env, stdio: 'inherit' });

electron.on('error', (error) => {
  console.error('Failed to start Electron:', error);
  process.exitCode = 1;
});

electron.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
