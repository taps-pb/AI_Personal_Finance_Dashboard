import { getCurrentUser } from "@/lib/user";
import { buildBackup, buildTransactionsCSV, buildTransactionsRows } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  const format = new URL(req.url).searchParams.get("format") ?? "backup";
  const date = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = await buildTransactionsCSV(user.id);
    return new Response(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="transactions-${date}.csv"` },
    });
  }
  if (format === "json") {
    const rows = await buildTransactionsRows(user.id);
    return new Response(JSON.stringify(rows, null, 2), {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="transactions-${date}.json"` },
    });
  }
  const backup = await buildBackup(user.id);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="finance-backup-${date}.json"` },
  });
}
