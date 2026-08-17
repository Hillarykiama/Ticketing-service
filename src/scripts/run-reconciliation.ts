import { reconcileStuckOrders, releaseExpiredReservations } from '../services/reconciliation.service';
import { logger } from '../utils/logger';

async function main() {
  const stuckCount = await reconcileStuckOrders();
  const expiredCount = await releaseExpiredReservations();

  logger.info({ stuckCount, expiredCount }, 'Reconciliation run complete');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Reconciliation run failed');
  process.exit(1);
});