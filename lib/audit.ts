// Lightweight audit log (spec §26). Records what changed, keyed by user.
import type { Db } from "./prisma-money.ts";

export async function writeAudit(
  db: Db,
  entry: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ? JSON.stringify(entry.before) : null,
      after: entry.after ? JSON.stringify(entry.after) : null,
    },
  });
}
