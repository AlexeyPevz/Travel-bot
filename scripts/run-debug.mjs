// Debug runner to trace early exits
process.on('beforeExit', (code) => {
  console.warn('[debug-runner] beforeExit', code);
});
process.on('exit', (code) => {
  console.warn('[debug-runner] exit', code);
});
process.on('uncaughtException', (err) => {
  console.error('[debug-runner] uncaughtException', err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('[debug-runner] unhandledRejection at', p, 'reason:', reason);
});

console.log('[debug-runner] importing server...');
import('../dist/server/index.js')
  .then(() => console.log('[debug-runner] server module imported'))
  .catch((e) => console.error('[debug-runner] import failed', e));

// Keep process alive briefly to observe events
setTimeout(() => console.log('[debug-runner] still alive after 5s'), 5000);


