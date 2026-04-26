"use client";

import { useState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSecurityAction } from "@/lib/actions/securities";
import { SecurityEditForm } from "./SecurityEditForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Search } from "lucide-react";

export interface SerializedSecurity {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  assetClass: string;
  sector: string | null;
  industry: string | null;
  isDividendAristocrat: boolean;
  isDividendKing: boolean;
  isPaysMonthly: boolean;
  dataSource: string;
  delisted: boolean;
  manualPrice: number | null;
  notes: string | null;
  importNames: string[];
  annualDividendCents: number | null;
  dividendFrequency: string | null;
  dividendGrowthYears: number | null;
  manualDividendOverride: boolean;
  isMine: boolean;
  transactionCount: number;
}

export function SecurityManagement({
  securities,
}: {
  securities: SerializedSecurity[];
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [editTarget, setEditTarget] = useState<SerializedSecurity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedSecurity | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = securities;
    if (mineOnly) list = list.filter((s) => s.isMine);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.importNames.some((a) => a.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [securities, mineOnly, search]);

  function handleDelete() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const result = await deleteSecurityAction(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("securityDeleted"));
        router.refresh();
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("securitiesDescription")}</p>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchSecurities")}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="mine-only" checked={mineOnly} onCheckedChange={setMineOnly} />
          <Label htmlFor="mine-only" className="text-sm whitespace-nowrap">{t("mySecuritiesOnly")}</Label>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} / {securities.length}
      </p>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnSymbol")}</TableHead>
              <TableHead>{t("columnName")}</TableHead>
              <TableHead>{t("columnCurrency")}</TableHead>
              <TableHead>{t("columnAssetClass")}</TableHead>
              <TableHead>{t("columnAliases")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("noSecurities")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((sec) => (
                <TableRow key={sec.id}>
                  <TableCell className="font-mono text-sm font-medium">
                    {sec.symbol}
                    <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">{sec.exchange}</Badge>
                    {sec.delisted && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0">{t("flagDelisted")}</Badge>}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{sec.name}</TableCell>
                  <TableCell className="text-sm">{sec.currency}</TableCell>
                  <TableCell className="text-xs">{sec.assetClass.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm">
                    {sec.importNames.length > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">{sec.importNames.length}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTarget(sec)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          {tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (sec.transactionCount > 0) {
                              toast.error(t("deleteSecurityBlocked", { count: sec.transactionCount }));
                            } else {
                              setDeleteTarget(sec);
                            }
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("editSecurity")} — {editTarget?.symbol}
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <SecurityEditForm
              security={editTarget}
              onSuccess={() => setEditTarget(null)}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title={t("deleteSecurity")}
          description={t("deleteSecurityConfirm", { symbol: deleteTarget.symbol, name: deleteTarget.name })}
          confirmLabel={tc("delete")}
          cancelLabel={tc("cancel")}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
