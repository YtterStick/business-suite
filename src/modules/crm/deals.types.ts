import type { DealStatus, StageType } from "@prisma/client";

import type { DealWonProvisioningResult } from "@/modules/crm/deal-won.automation";

export interface KanbanDealCardDTO {
  id: string;
  title: string;
  stageId: string;
  pipelineId: string;
  status: DealStatus;
  amount: number;
  currency: string;
  probability: number;
  position: number;
  expectedCloseDate: string | null;
  closedAt: string | null;
  company: {
    id: string;
    name: string;
  } | null;
  contact: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
  owner: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  invoiceCount: number;
  projectCount: number;
  latestInvoiceNumber: string | null;
  latestProjectId: string | null;
}

export interface KanbanStageColumnDTO {
  id: string;
  pipelineId: string;
  name: string;
  type: StageType;
  probability: number;
  position: number;
  color: string | null;
  deals: KanbanDealCardDTO[];
}

export interface SelectOptionDTO {
  id: string;
  label: string;
  secondary?: string | null;
}

export interface KanbanBoardDTO {
  pipeline: {
    id: string;
    name: string;
  };
  pipelines: Array<{
    id: string;
    name: string;
    isDefault: boolean;
  }>;
  stages: KanbanStageColumnDTO[];
  companies: SelectOptionDTO[];
  contacts: Array<SelectOptionDTO & { companyId: string | null }>;
}

export interface MoveDealInput {
  dealId: string;
  targetStageId: string;
  beforeDealId?: string | null;
  afterDealId?: string | null;
  lostReason?: string | null;
}

export interface MoveDealResultDTO {
  deal: {
    id: string;
    stageId: string;
    status: DealStatus;
    probability: number;
    position: number;
    closedAt: string | null;
  };
  automation: DealWonProvisioningResult | null;
}

export interface CreateDealInput {
  pipelineId: string;
  stageId: string;
  title: string;
  amount: number;
  currency?: string;
  companyId?: string | null;
  contactId?: string | null;
  expectedCloseDate?: string | null;
}

export interface CreateDealResultDTO {
  deal: KanbanDealCardDTO;
  automation: DealWonProvisioningResult | null;
}
