import type { InvoiceStatus, PaymentMethod, RecordSource } from "@prisma/client";

export interface InvoiceLineItemDTO {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  position: number;
}

export interface InvoicePaymentDTO {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
}

export interface InvoiceRecordDTO {
  id: string;
  number: string;
  status: InvoiceStatus;
  effectiveStatus: InvoiceStatus;
  source: RecordSource;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  company: {
    id: string;
    name: string;
    addressLine1: string | null;
    city: string | null;
    country: string | null;
  } | null;
  contact: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
  deal: {
    id: string;
    title: string;
  } | null;
  lineItems: InvoiceLineItemDTO[];
  payments: InvoicePaymentDTO[];
}

export interface InvoicesWorkspaceDTO {
  organization: {
    id: string;
    name: string;
    defaultCurrency: string;
    defaultPaymentTermsDays: number;
  };
  todayIso: string;
  dueSoonIso: string;
  invoices: InvoiceRecordDTO[];
  companies: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; fullName: string; email: string | null; companyId: string | null }>;
  deals: Array<{
    id: string;
    title: string;
    companyId: string | null;
    contactId: string | null;
    currency: string;
    amount: number;
  }>;
  catalogItems: Array<{
    id: string;
    sku: string;
    name: string;
    description: string | null;
    unitPrice: number;
    taxRate: number;
    currency: string;
  }>;
}
