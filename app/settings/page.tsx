import { Download } from "lucide-react";
import { getCurrentUser, getSettings } from "@/lib/user";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { CsvImport } from "@/components/csv-import";
import { SettingsForm, RestoreControl, DeleteAllControl } from "@/components/settings-controls";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const [settings, audit] = await Promise.all([
    getSettings(user.id),
    prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { timestamp: "desc" }, take: 25 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Preferences, data export, backup and import." />

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsForm autoUpdateBalances={settings.autoUpdateBalances} />
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>Currency: {settings.currency} · Timezone: {settings.timezone} · Date format: {settings.dateFormat}</p>
            <p>Theme is set from the toggle in the header (light / dark / system) and remembered per device.</p>
            <p>Balance changes are always recorded in each account&rsquo;s history, so updating a balance acts as a reconciliation rather than silently overwriting it.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Download your transactions or a full backup.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a href="/api/export?format=csv" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download /> Transactions CSV
          </a>
          <a href="/api/export?format=json" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download /> Transactions JSON
          </a>
          <a href="/api/export?format=backup" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download /> Full backup (JSON)
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import transactions (CSV)</CardTitle>
          <CardDescription>Upload a CSV, map its columns, preview, then import. Duplicates are skipped.</CardDescription>
        </CardHeader>
        <CardContent>
          <CsvImport />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restore from backup</CardTitle>
          <CardDescription>Replace all current data with a previously exported backup file.</CardDescription>
        </CardHeader>
        <CardContent>
          <RestoreControl />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>An audit trail of changes to your data.</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-xs text-muted-foreground">{a.action}</span>
                  <span className="text-muted-foreground">{a.entity}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(a.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Irreversible. Export a backup first if unsure.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAllControl />
        </CardContent>
      </Card>
    </div>
  );
}
