/**
 * Dashboard Module Entry Point — Phase 14
 * Exports all Phase 14 services and starts the dashboard server.
 */

export { startDashboardServer } from './server.js';
export { HealthWorker } from './health.worker.js';
export { BulkDispatcher, dispatchEvents } from './bulk-dispatcher.js';

/**
 * Start all Phase 14 services:
 *  - Health worker cron
 *  - Dashboard HTTP server
 *  - DB migration
 */
export async function startMissionControl() {
  const { runMigration } = await import('../database/schema/channels.js');
  const { startDashboardServer } = await import('./server.js');
  const { HealthWorker } = await import('./health.worker.js');
  const { startStaticServer } = await import('../social/services/static-server.js');

  // Run DB migration
  runMigration();

  // Start static file server (for Meta API video URLs)
  startStaticServer();

  // Start health worker cron
  HealthWorker.start();

  // Start dashboard server
  startDashboardServer();
}
