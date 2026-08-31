// Net-worth snapshots (spec §18). We snapshot lazily on read: viewing the
// dashboard records/updates today's snapshot, which is plenty for a manual
// single-user app and keeps the net-worth history real (not derived).
import { prisma } from "@/lib/db";
import { netWorth, totalAssets, totalLiabilities, type AccountLike } from "@/lib/finance/networth";

export async function ensureTodaySnapshot(userId: string) {
  const accounts = (await prisma.account.findMany({ where: { userId } })) as unknown as AccountLike[];
  const nw = netWorth(accounts);
  const assets = totalAssets(accounts);
  const liabilities = totalLiabilities(accounts);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const existing = await prisma.netWorthSnapshot.findFirst({ where: { userId, date: { gte: start, lt: end } } });
  if (existing) {
    if (existing.netWorthMinor !== nw) {
      await prisma.netWorthSnapshot.update({
        where: { id: existing.id },
        data: { netWorthMinor: nw, totalAssetsMinor: assets, totalLiabilitiesMinor: liabilities },
      });
    }
    return;
  }
  await prisma.netWorthSnapshot.create({
    data: { userId, date: start, netWorthMinor: nw, totalAssetsMinor: assets, totalLiabilitiesMinor: liabilities },
  });
}

export async function getNetWorthSnapshots(userId: string, from?: Date, to?: Date) {
  return prisma.netWorthSnapshot.findMany({
    where: { userId, ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
    orderBy: { date: "asc" },
  });
}
