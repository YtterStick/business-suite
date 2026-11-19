import { Prisma } from "@prisma/client";

export interface LineItemDraftInput {
  description: string;
  quantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  discountRate?: Prisma.Decimal.Value;
  taxRate: Prisma.Decimal.Value;
}

export interface ComputedLineItem {
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountRate: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  position: number;
}

export interface ComputedDocumentTotals {
  lineItems: ComputedLineItem[];
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
}

const HUNDRED = new Prisma.Decimal(100);
const ZERO = new Prisma.Decimal(0);

/**
 * Computes exact per-line and document-level monetary totals using arbitrary-
 * precision `Prisma.Decimal` arithmetic rounded half-up to 2 decimal places.
 */
export function computeLineItemsAndTotals(items: LineItemDraftInput[]): ComputedDocumentTotals {
  let subtotal = ZERO;
  let taxTotal = ZERO;

  const lineItems: ComputedLineItem[] = items.map((item, index) => {
    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const discountRate = new Prisma.Decimal(item.discountRate ?? 0);
    const taxRate = new Prisma.Decimal(item.taxRate);

    const gross = quantity.mul(unitPrice);
    const netFactor = HUNDRED.minus(discountRate).div(HUNDRED);
    const lineSubtotal = gross.mul(netFactor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const lineTax = lineSubtotal
      .mul(taxRate)
      .div(HUNDRED)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const lineTotal = lineSubtotal.plus(lineTax).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    subtotal = subtotal.plus(lineSubtotal);
    taxTotal = taxTotal.plus(lineTax);

    return {
      description: item.description,
      quantity,
      unitPrice,
      discountRate,
      taxRate,
      lineSubtotal,
      lineTax,
      lineTotal,
      position: index,
    };
  });

  const roundedSubtotal = subtotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const roundedTaxTotal = taxTotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const total = roundedSubtotal.plus(roundedTaxTotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    lineItems,
    subtotal: roundedSubtotal,
    taxTotal: roundedTaxTotal,
    total,
  };
}
