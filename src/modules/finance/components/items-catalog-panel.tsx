"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Loader2, Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import {
  createCatalogItemAction,
  toggleCatalogItemAction,
} from "@/modules/finance/finance-suite.actions";
import type { CatalogItemDTO } from "@/modules/finance/finance-suite.service";

export function ItemsCatalogPanel({
  orgSlug,
  defaultCurrency,
  items,
  canWrite,
}: {
  orgSlug: string;
  defaultCurrency: string;
  items: CatalogItemDTO[];
  canWrite: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [sku, setSku] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("5000");
  const [taxRate, setTaxRate] = React.useState("12");
  const [currency, setCurrency] = React.useState(defaultCurrency || "PHP");
  const [unit, setUnit] = React.useState("service");
  const [isPending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.sku.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createCatalogItemAction({
        orgSlug,
        sku,
        name,
        description: description || null,
        unitPrice: Number(unitPrice),
        taxRate: Number(taxRate),
        currency,
        unit,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSku("");
      setName("");
      setDescription("");
      setOpen(false);
      toast.success("Item added to catalog");
    });
  };

  const handleToggle = (itemId: string, isActive: boolean) => {
    startTransition(async () => {
      const res = await toggleCatalogItemAction({ orgSlug, itemId, isActive });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(isActive ? "Item activated" : "Item archived");
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Items Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Standardized products and services available for quick selection in Invoices &amp;
            Quotes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU or name..."
              className="h-9 pl-8 text-xs"
            />
          </div>
          {canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New Item
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4 text-emerald-600" />
            Products &amp; Services ({filtered.length})
          </CardTitle>
          <CardDescription>
            Active items appear inside the New Invoice line-item picker.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Tax %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No items in catalog yet. Click &ldquo;New Item&rdquo; to add one.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-semibold">{item.sku}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(item.unitPrice, item.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {item.taxRate}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite && (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleToggle(item.id, !item.isActive)}
                        >
                          {item.isActive ? (
                            <Archive className="size-3.5" />
                          ) : (
                            <ArchiveRestore className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Catalog Item</DialogTitle>
            <DialogDescription>Add a reusable product or service line item.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-sku">SKU</Label>
                <Input
                  id="item-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SVC-001"
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-name">Name</Label>
                <Input
                  id="item-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Monthly Retainer / Setup"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Input
                id="item-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope shown on invoice lines..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-rate">Standard Rate</Label>
                <Input
                  id="item-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-tax">Tax %</Label>
                <Input
                  id="item-tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-currency">Currency</Label>
                <select
                  id="item-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="PHP">PHP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-unit">Unit</Label>
              <Input
                id="item-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="service, hour, license, seat"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
