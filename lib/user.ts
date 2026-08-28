// Single-user app for now (spec §39). One default user + settings, created lazily.
// Everything is keyed by userId so multi-user is a later add with no schema change.
import { prisma } from "@/lib/db";

export async function getCurrentUser() {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const user = await prisma.user.create({ data: { name: "You" } });
  await prisma.setting.create({ data: { userId: user.id } });
  return user;
}

export async function getSettings(userId: string) {
  const s = await prisma.setting.findUnique({ where: { userId } });
  if (s) return s;
  return prisma.setting.create({ data: { userId } });
}
