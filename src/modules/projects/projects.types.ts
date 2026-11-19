import type {
  IssueSeverity,
  IssueStatus,
  ProjectStatus,
  RecordSource,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

export type ProjectTemplateKey =
  | "NONE"
  | "CLIENT_ONBOARDING"
  | "SOFTWARE_DELIVERY"
  | "MARKETING_LAUNCH"
  | "FINANCE_ERP_ROLLOUT"
  | "SECURITY_AUDIT";

export interface ProjectBlueprintPhase {
  name: string;
  offsetDays: number;
  tasks: string[];
}

export interface MentionReferenceItem {
  id: string;
  kind: "task" | "issue";
  code: string;
  title: string;
  projectName: string;
}

export interface ProjectActivityLogDTO {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  summary: string;
  createdAt: string;
}

export interface ProjectSummaryDTO {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  source: RecordSource;
  isStrict: boolean;
  isPublic: boolean;
  isArchived: boolean;
  rollupEnabled: boolean;
  businessHours: string;
  taskLayout: string;
  enabledTabs: string[];
  templateName: string | null;
  tags: string[];
  startDate: string | null;
  dueDate: string | null;
  budget: number | null;
  currency: string;
  completionPercent: number;
  taskCount: number;
  doneTaskCount: number;
  milestoneCount: number;
  issueCount: number;
  openIssueCount: number;
  expenseCount: number;
  hoursLogged: number;
  group: { id: string; name: string } | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  company: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
}

export interface ProjectsWorkspaceDTO {
  projects: ProjectSummaryDTO[];
  groups: Array<{ id: string; name: string; projectCount: number }>;
  members: Array<{ id: string; name: string; email: string }>;
  companies: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; title: string; companyId: string | null }>;
  mentionItems: MentionReferenceItem[];
  activityLogs: ProjectActivityLogDTO[];
}

export interface TaskSubtaskItem {
  id: string;
  commentId: string;
  title: string;
  done: boolean;
}

export interface TaskDependencyItem {
  commentId: string;
  relation: "PREDECESSOR" | "SUCCESSOR";
  targetTaskId: string;
  targetTaskTitle: string;
}

export interface TaskAttachmentItem {
  commentId: string;
  name: string;
  sizeLabel: string;
  category: string;
  url: string;
  authorName: string;
  createdAt: string;
}

export interface TaskActivityItem {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

export interface TaskCardDTO {
  id: string;
  projectId: string;
  projectName: string;
  milestoneId: string | null;
  milestoneName: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  startDate?: string | null;
  dueDate: string | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  subtasks?: TaskSubtaskItem[];
  dependencies?: TaskDependencyItem[];
  attachments?: TaskAttachmentItem[];
  comments?: Array<{ id: string; authorName: string; body: string; createdAt: string }>;
  timeLogs?: Array<{
    id: string;
    userName: string;
    hours: number;
    billable: boolean;
    loggedDate: string;
    notes: string | null;
  }>;
  activities?: TaskActivityItem[];
}

export interface TasksBoardDTO {
  tasks: TaskCardDTO[];
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
}

export interface CommentDTO {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface IssueRowDTO {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  reporter: { id: string; name: string } | null;
  createdAt: string;
}

export interface TimeLogRowDTO {
  id: string;
  projectId: string;
  projectName: string;
  taskTitle: string | null;
  userName: string;
  hours: number;
  billable: boolean;
  loggedDate: string;
  notes: string | null;
}

export interface SingleProjectWorkspaceDTO {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    source: RecordSource;
    isStrict: boolean;
    isPublic: boolean;
    isArchived: boolean;
    rollupEnabled: boolean;
    businessHours: string;
    taskLayout: string;
    enabledTabs: string[];
    templateName: string | null;
    tags: string[];
    startDate: string | null;
    dueDate: string | null;
    budget: number | null;
    currency: string;
    completionPercent: number;
    group: { id: string; name: string } | null;
    owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
    company: { id: string; name: string } | null;
    deal: {
      id: string;
      title: string;
      amount: number;
      currency: string;
      status: string;
    } | null;
  };
  allProjects: Array<{ id: string; name: string; status: ProjectStatus }>;
  milestones: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    dueDate: string | null;
    position: number;
    signoffStatus: string | null;
    taskCount: number;
    doneTaskCount: number;
  }>;
  tasks: TaskCardDTO[];
  issues: IssueRowDTO[];
  timeLogs: TimeLogRowDTO[];
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    total: number;
    balanceDue: number;
    currency: string;
  }>;
  expenses: Array<{
    id: string;
    title: string;
    category: string;
    amount: number;
    currency: string;
    billable: boolean;
    expenseDate: string;
    source: "FINANCE" | "CLAIM";
    status: string;
  }>;
  members: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    portalProfile: string;
    jobTitle: string | null;
    hourlyCostRate: number;
    assignedTaskCount: number;
    hoursLogged: number;
  }>;
  groups: Array<{ id: string; name: string }>;
  companies: Array<{ id: string; name: string }>;
  comments: CommentDTO[];
}
