-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quote_line_items" ADD COLUMN     "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
