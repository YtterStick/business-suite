import {
  ApprovalStatus,
  ContactLifecycleStage,
  DealStatus,
  ExpenseStatus,
  InvoiceStatus,
  IssueSeverity,
  IssueStatus,
  MembershipRole,
  MilestoneStatus,
  PaymentMethod,
  PortalProfile,
  Prisma,
  PrismaClient,
  ProjectStatus,
  QuoteStatus,
  RecordSource,
  SequenceKind,
  StageType,
  TaskPriority,
  TaskStatus,
  TimesheetStatus,
  UserType,
} from "@prisma/client";

import { addDays, startOfUtcDay } from "../src/lib/dates";
import { hashPassword } from "../src/server/auth/password";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe-123!";
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const org = await prisma.organization.upsert({
    where: { slug: "acme" },
    update: {
      defaultCurrency: "PHP",
    },
    create: {
      name: "Acme Cloud Corp",
      slug: "acme",
      defaultCurrency: "PHP",
      timezone: "Asia/Manila",
      invoicePrefix: "INV-",
      quotePrefix: "QT-",
      defaultPaymentTermsDays: 30,
    },
  });

  // ── 1. Users, Memberships & Teams ───────────────────────────────────────────
  const userSpecs = [
    {
      email: "owner@acme.test",
      name: "Alex Morgan",
      role: MembershipRole.OWNER,
      profile: PortalProfile.ADMIN,
      jobTitle: "Chief Executive Officer",
      rate: "2500.00",
    },
    {
      email: "admin@acme.test",
      name: "Priya Nair",
      role: MembershipRole.ADMIN,
      profile: PortalProfile.MANAGER,
      jobTitle: "VP of Delivery",
      rate: "1950.00",
    },
    {
      email: "rep@acme.test",
      name: "Jordan Lee",
      role: MembershipRole.MEMBER,
      profile: PortalProfile.STANDARD,
      jobTitle: "Account Executive",
      rate: "1200.00",
    },
    {
      email: "sofia@acme.test",
      name: "Sofia Reyes",
      role: MembershipRole.ADMIN,
      profile: PortalProfile.MANAGER,
      jobTitle: "Principal Solutions Architect",
      rate: "2100.00",
    },
    {
      email: "liam@acme.test",
      name: "Liam Chen",
      role: MembershipRole.MEMBER,
      profile: PortalProfile.STANDARD,
      jobTitle: "Senior Full-Stack Engineer",
      rate: "1650.00",
    },
    {
      email: "maya@acme.test",
      name: "Maya Patel",
      role: MembershipRole.MEMBER,
      profile: PortalProfile.STANDARD,
      jobTitle: "QA & Release Lead",
      rate: "1400.00",
    },
    {
      email: "lucas@acme.test",
      name: "Lucas Navarro",
      role: MembershipRole.MEMBER,
      profile: PortalProfile.CONTRACTOR,
      jobTitle: "Finance & ERP Consultant",
      rate: "1750.00",
    },
    {
      email: "hannah@acme.test",
      name: "Hannah Kim",
      role: MembershipRole.MEMBER,
      profile: PortalProfile.STANDARD,
      jobTitle: "Client Success Manager",
      rate: "1350.00",
    },
  ];

  const usersByEmail = new Map<string, { id: string; name: string; email: string }>();
  const membershipsByEmail = new Map<string, { id: string }>();

  for (const spec of userSpecs) {
    const u = await prisma.user.upsert({
      where: { email: spec.email },
      update: { name: spec.name, lastActiveOrgId: org.id },
      create: {
        email: spec.email,
        name: spec.name,
        passwordHash,
        emailVerifiedAt: now,
        lastActiveOrgId: org.id,
      },
      select: { id: true, name: true, email: true },
    });
    usersByEmail.set(spec.email, u);

    const m = await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: u.id } },
      update: {
        role: spec.role,
        portalProfile: spec.profile,
        jobTitle: spec.jobTitle,
        hourlyCostRate: new Prisma.Decimal(spec.rate),
      },
      create: {
        organizationId: org.id,
        userId: u.id,
        role: spec.role,
        userType: spec.profile === PortalProfile.CONTRACTOR ? UserType.CLIENT : UserType.PORTAL,
        portalProfile: spec.profile,
        jobTitle: spec.jobTitle,
        hourlyCostRate: new Prisma.Decimal(spec.rate),
      },
      select: { id: true },
    });
    membershipsByEmail.set(spec.email, m);
  }

  const owner = usersByEmail.get("owner@acme.test")!;
  const admin = usersByEmail.get("admin@acme.test")!;
  const rep = usersByEmail.get("rep@acme.test")!;
  const sofia = usersByEmail.get("sofia@acme.test")!;
  const liam = usersByEmail.get("liam@acme.test")!;
  const maya = usersByEmail.get("maya@acme.test")!;
  const lucas = usersByEmail.get("lucas@acme.test")!;
  const hannah = usersByEmail.get("hannah@acme.test")!;

  // Teams
  const teamDefs = [
    {
      name: "Core Engineering",
      description: "Platform architecture, API integrations, and QA",
      emails: ["sofia@acme.test", "liam@acme.test", "maya@acme.test"],
    },
    {
      name: "Delivery & PMO",
      description: "Enterprise rollouts, client onboarding, and sprint governance",
      emails: ["owner@acme.test", "admin@acme.test", "hannah@acme.test"],
    },
    {
      name: "Finance & Advisory",
      description: "ERP configuration, billing automation, and tax compliance",
      emails: ["lucas@acme.test", "rep@acme.test"],
    },
  ];

  for (const tDef of teamDefs) {
    const team = await prisma.team.upsert({
      where: { organizationId_name: { organizationId: org.id, name: tDef.name } },
      update: { description: tDef.description },
      create: { organizationId: org.id, name: tDef.name, description: tDef.description },
    });
    for (const email of tDef.emails) {
      const m = membershipsByEmail.get(email);
      if (m) {
        await prisma.teamMember.upsert({
          where: { teamId_membershipId: { teamId: team.id, membershipId: m.id } },
          update: {},
          create: { organizationId: org.id, teamId: team.id, membershipId: m.id },
        });
      }
    }
  }

  // Pending Invitations
  const existingInvites = await prisma.invitation.count({ where: { organizationId: org.id } });
  if (existingInvites === 0) {
    await prisma.invitation.createMany({
      data: [
        {
          organizationId: org.id,
          email: "elena.consultant@partner.test",
          role: MembershipRole.MEMBER,
          portalProfile: PortalProfile.CONTRACTOR,
          tokenHash: "seed-invite-token-1",
          invitedById: owner.id,
          expiresAt: addDays(now, 14),
        },
        {
          organizationId: org.id,
          email: "devops@acme.test",
          role: MembershipRole.ADMIN,
          portalProfile: PortalProfile.MANAGER,
          tokenHash: "seed-invite-token-2",
          invitedById: admin.id,
          expiresAt: addDays(now, 14),
        },
      ],
    });
  }

  // ── 2. CRM: Pipeline, Companies, Contacts & Deals ──────────────────────────
  const pipeline = await prisma.pipeline.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Sales Pipeline" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Sales Pipeline",
      isDefault: true,
      position: 0,
      stages: {
        create: [
          { name: "Qualified", type: StageType.OPEN, probability: 20, position: 0, color: "#64748b" },
          { name: "Discovery", type: StageType.OPEN, probability: 40, position: 1, color: "#3b82f6" },
          { name: "Proposal / Quote", type: StageType.OPEN, probability: 65, position: 2, color: "#8b5cf6" },
          { name: "Negotiation", type: StageType.OPEN, probability: 85, position: 3, color: "#f59e0b" },
          { name: "Closed Won", type: StageType.WON, probability: 100, position: 4, color: "#10b981" },
          { name: "Closed Lost", type: StageType.LOST, probability: 0, position: 5, color: "#ef4444" },
        ],
      },
    },
    include: { stages: true },
  });

  const stageByName = new Map(pipeline.stages.map((s) => [s.name, s]));

  const companySpecs = [
    { name: "Northstar Logistics", domain: "northstar.example", industry: "Supply Chain", city: "Chicago", country: "US", ownerId: owner.id },
    { name: "Meridian BioLabs", domain: "meridianbio.example", industry: "Biotechnology", city: "Boston", country: "US", ownerId: rep.id },
    { name: "Summit FinTech", domain: "summitfintech.example", industry: "Financial Services", city: "Austin", country: "US", ownerId: admin.id },
    { name: "Apex Retail Group", domain: "apexretail.example", industry: "E-Commerce & Retail", city: "Manila", country: "PH", ownerId: hannah.id },
    { name: "Horizon Energy Corp", domain: "horizonenergy.example", industry: "Clean Energy", city: "Singapore", country: "SG", ownerId: sofia.id },
    { name: "Vanguard Healthcare", domain: "vanguardhealth.example", industry: "Healthcare", city: "Cebu", country: "PH", ownerId: owner.id },
    { name: "Solaris Manufacturing", domain: "solaris.example", industry: "Manufacturing", city: "Tokyo", country: "JP", ownerId: lucas.id },
  ];

  const companiesByName = new Map<string, { id: string; name: string }>();
  for (const cs of companySpecs) {
    let comp = await prisma.company.findFirst({
      where: { organizationId: org.id, name: cs.name },
      select: { id: true, name: true },
    });
    if (!comp) {
      comp = await prisma.company.create({
        data: { organizationId: org.id, ...cs },
        select: { id: true, name: true },
      });
    }
    companiesByName.set(cs.name, comp);
  }

  const contactSpecs = [
    { firstName: "Elena", lastName: "Rostova", email: "elena@northstar.example", jobTitle: "VP of Operations", stage: ContactLifecycleStage.PROSPECT, company: "Northstar Logistics", ownerId: owner.id },
    { firstName: "Marcus", lastName: "Vance", email: "mvance@meridianbio.example", jobTitle: "Head of IT", stage: ContactLifecycleStage.LEAD, company: "Meridian BioLabs", ownerId: rep.id },
    { firstName: "Claire", lastName: "Benton", email: "claire@summitfintech.example", jobTitle: "Chief Operating Officer", stage: ContactLifecycleStage.CUSTOMER, company: "Summit FinTech", ownerId: admin.id },
    { firstName: "Rafael", lastName: "Santos", email: "rafael@apexretail.example", jobTitle: "Director of Digital", stage: ContactLifecycleStage.CUSTOMER, company: "Apex Retail Group", ownerId: hannah.id },
    { firstName: "Mei", lastName: "Tan", email: "mei.tan@horizonenergy.example", jobTitle: "Program Director", stage: ContactLifecycleStage.PROSPECT, company: "Horizon Energy Corp", ownerId: sofia.id },
    { firstName: "Dr. Aris", lastName: "Mendoza", email: "amendoza@vanguardhealth.example", jobTitle: "Chief Medical Officer", stage: ContactLifecycleStage.CUSTOMER, company: "Vanguard Healthcare", ownerId: owner.id },
    { firstName: "Kenji", lastName: "Takahashi", email: "kenji@solaris.example", jobTitle: "Plant Systems Lead", stage: ContactLifecycleStage.LEAD, company: "Solaris Manufacturing", ownerId: lucas.id },
  ];

  const contactsByEmail = new Map<string, { id: string }>();
  for (const ct of contactSpecs) {
    const company = companiesByName.get(ct.company)!;
    const contact = await prisma.contact.upsert({
      where: { organizationId_email: { organizationId: org.id, email: ct.email } },
      update: {},
      create: {
        organizationId: org.id,
        companyId: company.id,
        ownerId: ct.ownerId,
        firstName: ct.firstName,
        lastName: ct.lastName,
        email: ct.email,
        jobTitle: ct.jobTitle,
        lifecycleStage: ct.stage,
      },
      select: { id: true },
    });
    contactsByEmail.set(ct.email, contact);
  }

  const existingDealsCount = await prisma.deal.count({ where: { organizationId: org.id } });
  const dealsByTitle = new Map<string, { id: string; title: string; companyId: string | null }>();

  if (existingDealsCount < 5) {
    const dealSpecs = [
      {
        title: "Northstar Global ERP & CRM Suite",
        company: "Northstar Logistics",
        contactEmail: "elena@northstar.example",
        ownerId: owner.id,
        stageName: "Negotiation",
        status: DealStatus.OPEN,
        amount: "480000.00",
        offsetDays: 14,
      },
      {
        title: "Meridian Lab Compliance Portal",
        company: "Meridian BioLabs",
        contactEmail: "mvance@meridianbio.example",
        ownerId: rep.id,
        stageName: "Discovery",
        status: DealStatus.OPEN,
        amount: "225000.00",
        offsetDays: 30,
      },
      {
        title: "Summit FinTech Onboarding Suite",
        company: "Summit FinTech",
        contactEmail: "claire@summitfintech.example",
        ownerId: admin.id,
        stageName: "Closed Won",
        status: DealStatus.CLOSED_WON,
        amount: "360000.00",
        offsetDays: -12,
      },
      {
        title: "Apex Omnichannel POS & Inventory",
        company: "Apex Retail Group",
        contactEmail: "rafael@apexretail.example",
        ownerId: hannah.id,
        stageName: "Closed Won",
        status: DealStatus.CLOSED_WON,
        amount: "640000.00",
        offsetDays: -20,
      },
      {
        title: "Horizon Grid Telemetry Dashboard",
        company: "Horizon Energy Corp",
        contactEmail: "mei.tan@horizonenergy.example",
        ownerId: sofia.id,
        stageName: "Proposal / Quote",
        status: DealStatus.OPEN,
        amount: "520000.00",
        offsetDays: 21,
      },
      {
        title: "Vanguard Patient Portal Modernization",
        company: "Vanguard Healthcare",
        contactEmail: "amendoza@vanguardhealth.example",
        ownerId: owner.id,
        stageName: "Closed Won",
        status: DealStatus.CLOSED_WON,
        amount: "790000.00",
        offsetDays: -35,
      },
      {
        title: "Solaris Factory Floor IoT Pilot",
        company: "Solaris Manufacturing",
        contactEmail: "kenji@solaris.example",
        ownerId: lucas.id,
        stageName: "Qualified",
        status: DealStatus.OPEN,
        amount: "195000.00",
        offsetDays: 45,
      },
      {
        title: "Legacy Data Warehouse Migration",
        company: "Northstar Logistics",
        contactEmail: "elena@northstar.example",
        ownerId: rep.id,
        stageName: "Closed Lost",
        status: DealStatus.CLOSED_LOST,
        amount: "150000.00",
        offsetDays: -15,
      },
    ];

    for (const [idx, ds] of dealSpecs.entries()) {
      const existing = await prisma.deal.findFirst({
        where: { organizationId: org.id, title: ds.title },
        select: { id: true, title: true, companyId: true },
      });
      if (existing) {
        dealsByTitle.set(existing.title, existing);
        continue;
      }
      const st = stageByName.get(ds.stageName)!;
      const comp = companiesByName.get(ds.company)!;
      const cont = contactsByEmail.get(ds.contactEmail)!;
      const created = await prisma.deal.create({
        data: {
          organizationId: org.id,
          pipelineId: pipeline.id,
          stageId: st.id,
          companyId: comp.id,
          contactId: cont.id,
          ownerId: ds.ownerId,
          title: ds.title,
          amount: new Prisma.Decimal(ds.amount),
          currency: "PHP",
          status: ds.status,
          probability: st.probability,
          position: (idx + 1) * 1024,
          expectedCloseDate: startOfUtcDay(addDays(now, ds.offsetDays)),
          closedAt: ds.status !== DealStatus.OPEN ? addDays(now, ds.offsetDays) : null,
        },
        select: { id: true, title: true, companyId: true },
      });
      dealsByTitle.set(created.title, created);
    }
  } else {
    const allDeals = await prisma.deal.findMany({
      where: { organizationId: org.id },
      select: { id: true, title: true, companyId: true },
    });
    for (const d of allDeals) dealsByTitle.set(d.title, d);
  }

  // ── 3. Projects, Groups, Phases, Tasks, Issues, Time Logs & Approvals ───────
  const groupNames = [
    "Enterprise Rollouts",
    "Client Onboarding",
    "Security & Compliance",
    "Internal Platforms",
  ];
  const groupsByName = new Map<string, { id: string }>();
  for (const gn of groupNames) {
    const g = await prisma.projectGroup.upsert({
      where: { organizationId_name: { organizationId: org.id, name: gn } },
      update: {},
      create: { organizationId: org.id, name: gn },
      select: { id: true },
    });
    groupsByName.set(gn, g);
  }

  const existingProjectCount = await prisma.project.count({ where: { organizationId: org.id } });
  if (existingProjectCount < 4) {
    const projectSpecs = [
      {
        name: "Summit FinTech Onboarding Suite",
        description: "End-to-end client onboarding, SSO setup, and automated billing rollout.",
        status: ProjectStatus.ACTIVE,
        source: RecordSource.AUTOMATION,
        group: "Client Onboarding",
        company: "Summit FinTech",
        dealTitle: "Summit FinTech Onboarding Suite",
        ownerId: admin.id,
        startOffset: -18,
        dueOffset: 24,
        budget: "360000.00",
        isStrict: true,
        isPublic: true,
        isArchived: false,
        tags: ["fintech", "onboarding", "enterprise"],
        phases: [
          {
            name: "Kickoff & Discovery",
            status: MilestoneStatus.COMPLETED,
            dueOffset: -10,
            signoff: ApprovalStatus.APPROVED,
            tasks: [
              { title: "Stakeholder alignment & SLA charter", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignee: admin.id, dueOffset: -12 },
              { title: "Provision multi-tenant sandbox", status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignee: sofia.id, dueOffset: -10 },
            ],
          },
          {
            name: "SSO & Data Migration",
            status: MilestoneStatus.IN_PROGRESS,
            dueOffset: 7,
            signoff: ApprovalStatus.PENDING,
            tasks: [
              { title: "Configure SAML 2.0 identity provider", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, assignee: liam.id, dueOffset: 3 },
              { title: "Import historical ledger balances", status: TaskStatus.IN_REVIEW, priority: TaskPriority.HIGH, assignee: lucas.id, dueOffset: 5 },
              { title: "Validate webhook event signatures", status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assignee: maya.id, dueOffset: 7 },
            ],
          },
          {
            name: "Go-Live & Hypercare",
            status: MilestoneStatus.PENDING,
            dueOffset: 22,
            signoff: null,
            tasks: [
              { title: "Production cutover checklist", status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignee: admin.id, dueOffset: 20 },
            ],
          },
        ],
      },
      {
        name: "Apex Omnichannel POS & Inventory",
        description: "Multi-branch retail POS sync, warehouse barcode scanning, and real-time invoicing.",
        status: ProjectStatus.ACTIVE,
        source: RecordSource.AUTOMATION,
        group: "Enterprise Rollouts",
        company: "Apex Retail Group",
        dealTitle: "Apex Omnichannel POS & Inventory",
        ownerId: sofia.id,
        startOffset: -25,
        dueOffset: 18,
        budget: "640000.00",
        isStrict: true,
        isPublic: false,
        isArchived: false,
        tags: ["retail", "pos", "erp"],
        phases: [
          {
            name: "Architecture & SKU Mapping",
            status: MilestoneStatus.COMPLETED,
            dueOffset: -14,
            signoff: ApprovalStatus.APPROVED,
            tasks: [
              { title: "Finalize SKU catalog hierarchy", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignee: sofia.id, dueOffset: -16 },
              { title: "Design warehouse sync queue", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignee: liam.id, dueOffset: -14 },
            ],
          },
          {
            name: "Storefront Integration",
            status: MilestoneStatus.IN_PROGRESS,
            dueOffset: 5,
            signoff: ApprovalStatus.PENDING,
            tasks: [
              { title: "Build offline POS receipt buffer", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, assignee: liam.id, dueOffset: 2 },
              { title: "Load test 50 concurrent registers", status: TaskStatus.IN_REVIEW, priority: TaskPriority.HIGH, assignee: maya.id, dueOffset: 4 },
            ],
          },
        ],
      },
      {
        name: "Vanguard Patient Portal Modernization",
        description: "HIPAA-aligned patient scheduling, lab results viewer, and telehealth billing.",
        status: ProjectStatus.ACTIVE,
        source: RecordSource.MANUAL,
        group: "Enterprise Rollouts",
        company: "Vanguard Healthcare",
        dealTitle: "Vanguard Patient Portal Modernization",
        ownerId: owner.id,
        startOffset: -40,
        dueOffset: -3, // Intentionally overdue so "Delayed Projects" view shows data!
        budget: "790000.00",
        isStrict: true,
        isPublic: true,
        isArchived: false,
        tags: ["healthcare", "portal", "priority"],
        phases: [
          {
            name: "Security & Privacy Baseline",
            status: MilestoneStatus.COMPLETED,
            dueOffset: -22,
            signoff: ApprovalStatus.APPROVED,
            tasks: [
              { title: "Audit role-based record isolation", status: TaskStatus.DONE, priority: TaskPriority.URGENT, assignee: sofia.id, dueOffset: -24 },
            ],
          },
          {
            name: "Patient Scheduling & Billing",
            status: MilestoneStatus.IN_PROGRESS,
            dueOffset: -4,
            signoff: ApprovalStatus.PENDING,
            tasks: [
              { title: "Fix timezone offset on clinic slots", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, assignee: liam.id, dueOffset: -2 },
              { title: "UAT regression suite sign-off", status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignee: maya.id, dueOffset: -1 },
            ],
          },
        ],
      },
      {
        name: "Northstar ERP & CRM Discovery",
        description: "Technical scoping, legacy data profiling, and migration blueprint for Northstar.",
        status: ProjectStatus.PLANNING,
        source: RecordSource.MANUAL,
        group: "Enterprise Rollouts",
        company: "Northstar Logistics",
        dealTitle: "Northstar Global ERP & CRM Suite",
        ownerId: owner.id,
        startOffset: 2,
        dueOffset: 45,
        budget: "480000.00",
        isStrict: false,
        isPublic: true,
        isArchived: false,
        tags: ["erp", "crm", "logistics"],
        phases: [
          {
            name: "Data Profiling & Blueprint",
            status: MilestoneStatus.IN_PROGRESS,
            dueOffset: 15,
            signoff: null,
            tasks: [
              { title: "Extract sample freight & billing tables", status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignee: lucas.id, dueOffset: 10 },
              { title: "Draft executive steering deck", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, assignee: owner.id, dueOffset: 12 },
            ],
          },
        ],
      },
      {
        name: "SOC2 Type II & ISO 27001 Readiness",
        description: "Annual security audit, access control verification, and disaster recovery drills.",
        status: ProjectStatus.ACTIVE,
        source: RecordSource.MANUAL,
        group: "Security & Compliance",
        company: null,
        dealTitle: null,
        ownerId: sofia.id,
        startOffset: -15,
        dueOffset: 30,
        budget: "210000.00",
        isStrict: true,
        isPublic: false,
        isArchived: false,
        tags: ["security", "compliance", "audit"],
        phases: [
          {
            name: "Evidence Collection",
            status: MilestoneStatus.IN_PROGRESS,
            dueOffset: 10,
            signoff: null,
            tasks: [
              { title: "Rotate production API signing keys", status: TaskStatus.DONE, priority: TaskPriority.URGENT, assignee: sofia.id, dueOffset: -5 },
              { title: "Run automated tenant isolation tests", status: TaskStatus.IN_REVIEW, priority: TaskPriority.HIGH, assignee: maya.id, dueOffset: 4 },
              { title: "Verify backup restore RTO < 15m", status: TaskStatus.TODO, priority: TaskPriority.HIGH, assignee: liam.id, dueOffset: 9 },
            ],
          },
        ],
      },
      {
        name: "Horizon Telemetry Pilot",
        description: "Clean energy grid sensor ingestion & executive KPI reporting.",
        status: ProjectStatus.ON_HOLD,
        source: RecordSource.MANUAL,
        group: "Client Onboarding",
        company: "Horizon Energy Corp",
        dealTitle: "Horizon Grid Telemetry Dashboard",
        ownerId: hannah.id,
        startOffset: -10,
        dueOffset: 50,
        budget: "520000.00",
        isStrict: false,
        isPublic: true,
        isArchived: false,
        tags: ["energy", "iot", "analytics"],
        phases: [
          {
            name: "Sensor Ingestion Prototype",
            status: MilestoneStatus.PENDING,
            dueOffset: 25,
            signoff: null,
            tasks: [
              { title: "Confirm MQTT broker credentials", status: TaskStatus.TODO, priority: TaskPriority.LOW, assignee: hannah.id, dueOffset: 18 },
            ],
          },
        ],
      },
      {
        name: "Finance Billing Engine v2",
        description: "Automated gap-free invoice sequences, multi-currency FX, and Stripe webhooks.",
        status: ProjectStatus.COMPLETED,
        source: RecordSource.MANUAL,
        group: "Internal Platforms",
        company: null,
        dealTitle: null,
        ownerId: lucas.id,
        startOffset: -60,
        dueOffset: -10,
        budget: "310000.00",
        isStrict: false,
        isPublic: true,
        isArchived: false,
        tags: ["finance", "billing", "internal"],
        phases: [
          {
            name: "Release & Verification",
            status: MilestoneStatus.COMPLETED,
            dueOffset: -10,
            signoff: ApprovalStatus.APPROVED,
            tasks: [
              { title: "Deploy row-locked invoice sequence", status: TaskStatus.DONE, priority: TaskPriority.URGENT, assignee: lucas.id, dueOffset: -15 },
              { title: "Reconcile Q3 test ledger", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assignee: admin.id, dueOffset: -11 },
            ],
          },
        ],
      },
      {
        name: "Q1 Legacy Portal Sunset",
        description: "Decommissioning of legacy PHP v1 customer portal and archival of static assets.",
        status: ProjectStatus.COMPLETED,
        source: RecordSource.MANUAL,
        group: "Internal Platforms",
        company: null,
        dealTitle: null,
        ownerId: liam.id,
        startOffset: -120,
        dueOffset: -65,
        budget: "95000.00",
        isStrict: false,
        isPublic: false,
        isArchived: true, // Archived project!
        tags: ["legacy", "sunset"],
        phases: [
          {
            name: "Decommission",
            status: MilestoneStatus.COMPLETED,
            dueOffset: -65,
            signoff: ApprovalStatus.APPROVED,
            tasks: [
              { title: "Redirect legacy DNS endpoints", status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, assignee: liam.id, dueOffset: -68 },
            ],
          },
        ],
      },
    ];

    const createdProjects: Array<{ id: string; name: string; tasks: Array<{ id: string; title: string }> }> = [];

    for (const ps of projectSpecs) {
      const grp = groupsByName.get(ps.group);
      const comp = ps.company ? companiesByName.get(ps.company) : null;
      const deal = ps.dealTitle ? dealsByTitle.get(ps.dealTitle) : null;

      const proj = await prisma.project.create({
        data: {
          organizationId: org.id,
          groupId: grp?.id ?? null,
          name: ps.name,
          description: ps.description,
          status: ps.status,
          source: ps.source,
          ownerId: ps.ownerId,
          companyId: comp?.id ?? null,
          dealId: deal?.id ?? null,
          startDate: startOfUtcDay(addDays(now, ps.startOffset)),
          dueDate: startOfUtcDay(addDays(now, ps.dueOffset)),
          budget: new Prisma.Decimal(ps.budget),
          currency: "PHP",
          isStrict: ps.isStrict,
          isPublic: ps.isPublic,
          isArchived: ps.isArchived,
          tags: ps.tags,
        },
        select: { id: true, name: true },
      });

      const projTasks: Array<{ id: string; title: string }> = [];
      let taskPos = 1024;

      for (const [mIdx, ph] of ps.phases.entries()) {
        const ms = await prisma.milestone.create({
          data: {
            organizationId: org.id,
            projectId: proj.id,
            name: ph.name,
            status: ph.status,
            dueDate: startOfUtcDay(addDays(now, ph.dueOffset)),
            position: mIdx,
            signoffStatus: ph.signoff,
            signoffRequestedById: ph.signoff ? ps.ownerId : null,
            signoffRequestedAt: ph.signoff ? addDays(now, -2) : null,
            signoffReviewedById: ph.signoff === ApprovalStatus.APPROVED ? owner.id : null,
            signoffReviewedAt: ph.signoff === ApprovalStatus.APPROVED ? addDays(now, -1) : null,
            signoffNotes:
              ph.signoff === ApprovalStatus.APPROVED
                ? "Verified deliverables against acceptance criteria."
                : ph.signoff === ApprovalStatus.PENDING
                  ? "Ready for stakeholder milestone review."
                  : null,
          },
          select: { id: true },
        });

        for (const tk of ph.tasks) {
          const createdTask = await prisma.task.create({
            data: {
              organizationId: org.id,
              projectId: proj.id,
              milestoneId: ms.id,
              assigneeId: tk.assignee,
              reporterId: ps.ownerId,
              title: tk.title,
              status: tk.status,
              priority: tk.priority,
              position: taskPos,
              dueDate: startOfUtcDay(addDays(now, tk.dueOffset)),
              completedAt: tk.status === TaskStatus.DONE ? addDays(now, -1) : null,
            },
            select: { id: true, title: true },
          });
          projTasks.push(createdTask);
          taskPos += 1024;
        }
      }

      createdProjects.push({ id: proj.id, name: proj.name, tasks: projTasks });
    }

    // Issues across projects
    const issueSpecs = [
      { projIdx: 0, title: "SAML assertion clock skew on ADFS login", severity: IssueSeverity.HIGH, status: IssueStatus.IN_PROGRESS, assigneeId: liam.id, dueOffset: 2 },
      { projIdx: 0, title: "CSV import skips UTF-8 BOM headers", severity: IssueSeverity.MEDIUM, status: IssueStatus.OPEN, assigneeId: maya.id, dueOffset: 5 },
      { projIdx: 1, title: "Offline POS queue duplicates receipt on reconnect", severity: IssueSeverity.CRITICAL, status: IssueStatus.OPEN, assigneeId: liam.id, dueOffset: 1 },
      { projIdx: 1, title: "Barcode scanner focus loss on Safari iPadOS", severity: IssueSeverity.HIGH, status: IssueStatus.IN_PROGRESS, assigneeId: sofia.id, dueOffset: 4 },
      { projIdx: 2, title: "Patient appointment slot renders UTC instead of Asia/Manila", severity: IssueSeverity.CRITICAL, status: IssueStatus.IN_PROGRESS, assigneeId: liam.id, dueOffset: -1 },
      { projIdx: 2, title: "PDF lab report footer overlaps signature block", severity: IssueSeverity.LOW, status: IssueStatus.RESOLVED, assigneeId: maya.id, dueOffset: -3 },
      { projIdx: 4, title: "Audit export rate-limit triggers on >500 rows", severity: IssueSeverity.MEDIUM, status: IssueStatus.OPEN, assigneeId: sofia.id, dueOffset: 6 },
      { projIdx: 6, title: "Multi-currency rounding 0.01 PHP variance", severity: IssueSeverity.LOW, status: IssueStatus.CLOSED, assigneeId: lucas.id, dueOffset: -12 },
    ];

    for (const is of issueSpecs) {
      const targetProj = createdProjects[is.projIdx];
      if (!targetProj) continue;
      await prisma.issue.create({
        data: {
          organizationId: org.id,
          projectId: targetProj.id,
          reporterId: admin.id,
          assigneeId: is.assigneeId,
          title: is.title,
          description: `Tracked issue for ${targetProj.name}.`,
          severity: is.severity,
          status: is.status,
          dueDate: startOfUtcDay(addDays(now, is.dueOffset)),
        },
      });
    }

    // Timesheets & Time Logs
    const weekStart = startOfUtcDay(addDays(now, -((now.getUTCDay() + 6) % 7)));
    const prevWeekStart = startOfUtcDay(addDays(weekStart, -7));

    const tsSubmitted = await prisma.timesheet.upsert({
      where: { organizationId_userId_weekStartDate: { organizationId: org.id, userId: liam.id, weekStartDate: weekStart } },
      update: {},
      create: {
        organizationId: org.id,
        userId: liam.id,
        weekStartDate: weekStart,
        status: TimesheetStatus.SUBMITTED,
        totalHours: new Prisma.Decimal("18.50"),
        notes: "Sprint 4 SSO & POS offline buffer engineering",
        submittedAt: addDays(now, -1),
      },
    });

    const tsApproved = await prisma.timesheet.upsert({
      where: { organizationId_userId_weekStartDate: { organizationId: org.id, userId: sofia.id, weekStartDate: prevWeekStart } },
      update: {},
      create: {
        organizationId: org.id,
        userId: sofia.id,
        weekStartDate: prevWeekStart,
        status: TimesheetStatus.APPROVED,
        totalHours: new Prisma.Decimal("24.00"),
        notes: "Architecture review & security compliance baseline",
        submittedAt: addDays(now, -5),
        reviewedById: owner.id,
        reviewedAt: addDays(now, -4),
        reviewNotes: "Approved for client billing.",
      },
    });

    const tsDraft = await prisma.timesheet.upsert({
      where: { organizationId_userId_weekStartDate: { organizationId: org.id, userId: maya.id, weekStartDate: weekStart } },
      update: {},
      create: {
        organizationId: org.id,
        userId: maya.id,
        weekStartDate: weekStart,
        status: TimesheetStatus.DRAFT,
        totalHours: new Prisma.Decimal("10.00"),
        notes: "QA regression testing & load verification",
      },
    });

    const timeLogSeeds = [
      { projIdx: 0, taskIdx: 2, userId: liam.id, tsId: tsSubmitted.id, hours: "6.50", billable: true, offset: -2, notes: "Implemented SAML assertion validation & IdP metadata parser" },
      { projIdx: 1, taskIdx: 2, userId: liam.id, tsId: tsSubmitted.id, hours: "7.00", billable: true, offset: -1, notes: "Built IndexedDB offline POS transaction queue" },
      { projIdx: 2, taskIdx: 1, userId: liam.id, tsId: tsSubmitted.id, hours: "5.00", billable: true, offset: 0, notes: "Fixed clinic slot timezone conversion" },
      { projIdx: 1, taskIdx: 0, userId: sofia.id, tsId: tsApproved.id, hours: "8.00", billable: true, offset: -8, notes: "SKU hierarchy & multi-branch inventory sync spec" },
      { projIdx: 4, taskIdx: 0, userId: sofia.id, tsId: tsApproved.id, hours: "8.00", billable: false, offset: -7, notes: "Rotated production KMS signing keys & verified audit logs" },
      { projIdx: 0, taskIdx: 1, userId: sofia.id, tsId: tsApproved.id, hours: "8.00", billable: true, offset: -6, notes: "Provisioned multi-tenant sandbox & RBAC policies" },
      { projIdx: 1, taskIdx: 3, userId: maya.id, tsId: tsDraft.id, hours: "6.00", billable: true, offset: -1, notes: "Executed 50-register concurrent load test" },
      { projIdx: 4, taskIdx: 1, userId: maya.id, tsId: tsDraft.id, hours: "4.00", billable: false, offset: 0, notes: "Automated tenant isolation test suite" },
      { projIdx: 0, taskIdx: 3, userId: lucas.id, tsId: null, hours: "5.50", billable: true, offset: -2, notes: "Reconciled historical client ledger balances" },
    ];

    for (const tl of timeLogSeeds) {
      const targetProj = createdProjects[tl.projIdx];
      if (!targetProj) continue;
      const targetTask = targetProj.tasks[tl.taskIdx] ?? null;
      await prisma.timeLog.create({
        data: {
          organizationId: org.id,
          projectId: targetProj.id,
          taskId: targetTask?.id ?? null,
          timesheetId: tl.tsId,
          userId: tl.userId,
          hours: new Prisma.Decimal(tl.hours),
          billable: tl.billable,
          loggedDate: startOfUtcDay(addDays(now, tl.offset)),
          notes: tl.notes,
        },
      });
    }

    // Expense Claims (for Approvals & Project Finance)
    const claimSeeds = [
      { projIdx: 0, submitter: admin.id, title: "On-site Executive Kickoff Travel", category: "Travel", amount: "14500.00", status: ApprovalStatus.PENDING, offset: -2 },
      { projIdx: 1, submitter: liam.id, title: "Thermal Receipt Printer & Scanner Test Kit", category: "Hardware", amount: "18900.00", status: ApprovalStatus.PENDING, offset: -1 },
      { projIdx: 2, submitter: sofia.id, title: "HIPAA Compliance Penetration Scan", category: "Security", amount: "32000.00", status: ApprovalStatus.APPROVED, offset: -10 },
      { projIdx: 4, submitter: maya.id, title: "Load Testing Cloud Cluster Burst", category: "Infrastructure", amount: "8400.00", status: ApprovalStatus.REJECTED, offset: -6 },
    ];

    for (const cl of claimSeeds) {
      const targetProj = createdProjects[cl.projIdx];
      if (!targetProj) continue;
      await prisma.expenseClaim.create({
        data: {
          organizationId: org.id,
          projectId: targetProj.id,
          submitterId: cl.submitter,
          title: cl.title,
          category: cl.category,
          amount: new Prisma.Decimal(cl.amount),
          currency: "PHP",
          expenseDate: startOfUtcDay(addDays(now, cl.offset)),
          status: cl.status,
          notes: `Submitted for ${targetProj.name}.`,
          reviewedById: cl.status !== ApprovalStatus.PENDING ? owner.id : null,
          reviewedAt: cl.status !== ApprovalStatus.PENDING ? addDays(now, -1) : null,
          reviewNotes:
            cl.status === ApprovalStatus.APPROVED
              ? "Approved against project budget."
              : cl.status === ApprovalStatus.REJECTED
                ? "Please use the shared QA staging cluster instead of an external burst."
                : null,
        },
      });
    }

    // Workspace Collaboration Comments & Audit Logs
    await prisma.comment.createMany({
      data: [
        {
          organizationId: org.id,
          authorId: owner.id,
          entityType: "Workspace",
          entityId: org.id,
          body: "Q4 delivery sprint is live — please submit weekly timesheets by Friday 5:00 PM.",
        },
        {
          organizationId: org.id,
          authorId: sofia.id,
          entityType: "Workspace",
          entityId: org.id,
          body: "Completed security baseline audit for Summit FinTech & Vanguard Healthcare.",
        },
        {
          organizationId: org.id,
          authorId: liam.id,
          entityType: "Workspace",
          entityId: org.id,
          body: "Offline POS sync queue is ready for staging QA testing.",
        },
      ],
    });

    await prisma.auditLog.createMany({
      data: createdProjects.slice(0, 5).map((cp, i) => ({
        organizationId: org.id,
        actorId: i % 2 === 0 ? owner.id : admin.id,
        entityType: "Project",
        entityId: cp.id,
        action: i < 2 ? "project.automation_created" : "project.created",
        metadata: { name: cp.name },
      })),
    });
  }

  // ── 4. Finance: Catalog Items, Quotes, Invoices, Payments & Expenses ────────
  const existingCatalogCount = await prisma.catalogItem.count({ where: { organizationId: org.id } });
  if (existingCatalogCount === 0) {
    await prisma.catalogItem.createMany({
      data: [
        { organizationId: org.id, sku: "ENT-SEAT-YR", name: "Enterprise Suite Seat (Annual)", description: "Full CRM, Finance & Projects seat license", unitPrice: new Prisma.Decimal("3600.00"), taxRate: new Prisma.Decimal("12.00"), unit: "seat" },
        { organizationId: org.id, sku: "IMP-PKG-PRO", name: "Enterprise Implementation Package", description: "Architecture, SSO setup, and data migration", unitPrice: new Prisma.Decimal("120000.00"), taxRate: new Prisma.Decimal("12.00"), unit: "project" },
        { organizationId: org.id, sku: "SEC-AUD-01", name: "SOC2 & Security Readiness Audit", description: "RBAC review, pen-test coordination & sign-off", unitPrice: new Prisma.Decimal("85000.00"), taxRate: new Prisma.Decimal("12.00"), unit: "engagement" },
        { organizationId: org.id, sku: "CONS-HR", name: "Solutions Architect Consulting", description: "Hourly senior engineering & advisory rate", unitPrice: new Prisma.Decimal("3500.00"), taxRate: new Prisma.Decimal("12.00"), unit: "hour" },
        { organizationId: org.id, sku: "SLA-24X7", name: "Dedicated 24/7 Priority SLA", description: "15-minute critical incident response", unitPrice: new Prisma.Decimal("45000.00"), taxRate: new Prisma.Decimal("12.00"), unit: "month" },
      ],
    });
  }

  const existingInvoiceCount = await prisma.invoice.count({ where: { organizationId: org.id } });
  if (existingInvoiceCount < 3) {
    const summitComp = companiesByName.get("Summit FinTech")!;
    const apexComp = companiesByName.get("Apex Retail Group")!;
    const vanguardComp = companiesByName.get("Vanguard Healthcare")!;
    const northstarComp = companiesByName.get("Northstar Logistics")!;

    const invDefs = [
      {
        number: "INV-0001",
        status: InvoiceStatus.PAID,
        companyId: summitComp.id,
        issueOffset: -20,
        dueOffset: -5,
        subtotal: "321428.57",
        taxTotal: "38571.43",
        total: "360000.00",
        amountPaid: "360000.00",
        desc: "Summit FinTech Onboarding & Annual Enterprise License",
      },
      {
        number: "INV-0002",
        status: InvoiceStatus.PARTIALLY_PAID,
        companyId: apexComp.id,
        issueOffset: -15,
        dueOffset: 15,
        subtotal: "571428.57",
        taxTotal: "68571.43",
        total: "640000.00",
        amountPaid: "320000.00",
        desc: "Apex Omnichannel POS & Inventory Milestone 1 (50% Deposit)",
      },
      {
        number: "INV-0003",
        status: InvoiceStatus.OVERDUE,
        companyId: vanguardComp.id,
        issueOffset: -45,
        dueOffset: -10,
        subtotal: "250000.00",
        taxTotal: "30000.00",
        total: "280000.00",
        amountPaid: "0.00",
        desc: "Vanguard Patient Portal — Phase 1 & Security Baseline",
      },
      {
        number: "INV-0004",
        status: InvoiceStatus.SENT,
        companyId: northstarComp.id,
        issueOffset: -3,
        dueOffset: 27,
        subtotal: "120000.00",
        taxTotal: "14400.00",
        total: "134400.00",
        amountPaid: "0.00",
        desc: "Northstar Logistics — Technical Discovery & Blueprinting",
      },
    ];

    for (const idf of invDefs) {
      const exists = await prisma.invoice.findUnique({
        where: { organizationId_number: { organizationId: org.id, number: idf.number } },
      });
      if (exists) continue;
      const inv = await prisma.invoice.create({
        data: {
          organizationId: org.id,
          number: idf.number,
          status: idf.status,
          source: RecordSource.MANUAL,
          companyId: idf.companyId,
          createdById: owner.id,
          issueDate: startOfUtcDay(addDays(now, idf.issueOffset)),
          dueDate: startOfUtcDay(addDays(now, idf.dueOffset)),
          currency: "PHP",
          subtotal: new Prisma.Decimal(idf.subtotal),
          taxTotal: new Prisma.Decimal(idf.taxTotal),
          total: new Prisma.Decimal(idf.total),
          amountPaid: new Prisma.Decimal(idf.amountPaid),
          sentAt: addDays(now, idf.issueOffset),
          paidAt: idf.status === InvoiceStatus.PAID ? addDays(now, -6) : null,
          lineItems: {
            create: [
              {
                description: idf.desc,
                quantity: new Prisma.Decimal("1"),
                unitPrice: new Prisma.Decimal(idf.subtotal),
                taxRate: new Prisma.Decimal("12.00"),
                lineSubtotal: new Prisma.Decimal(idf.subtotal),
                lineTax: new Prisma.Decimal(idf.taxTotal),
                lineTotal: new Prisma.Decimal(idf.total),
                position: 0,
              },
            ],
          },
        },
      });

      if (Number(idf.amountPaid) > 0) {
        await prisma.payment.create({
          data: {
            organizationId: org.id,
            invoiceId: inv.id,
            amount: new Prisma.Decimal(idf.amountPaid),
            method: PaymentMethod.BANK_TRANSFER,
            reference: `TXN-${idf.number}`,
            paidAt: addDays(now, -6),
          },
        });
      }
    }

    await prisma.documentSequence.upsert({
      where: { organizationId_kind: { organizationId: org.id, kind: SequenceKind.INVOICE } },
      update: { nextValue: 5 },
      create: { organizationId: org.id, kind: SequenceKind.INVOICE, nextValue: 5 },
    });

    // Quotes
    const existingQuotes = await prisma.quote.count({ where: { organizationId: org.id } });
    if (existingQuotes === 0) {
      await prisma.quote.create({
        data: {
          organizationId: org.id,
          number: "QT-0001",
          status: QuoteStatus.SENT,
          companyId: northstarComp.id,
          createdById: rep.id,
          issueDate: startOfUtcDay(addDays(now, -4)),
          expiryDate: startOfUtcDay(addDays(now, 26)),
          currency: "PHP",
          subtotal: new Prisma.Decimal("428571.43"),
          taxTotal: new Prisma.Decimal("51428.57"),
          total: new Prisma.Decimal("480000.00"),
          notes: "Includes 120 annual enterprise seats and migration package.",
          lineItems: {
            create: [
              {
                description: "Northstar Global ERP & CRM Suite (120 seats)",
                quantity: new Prisma.Decimal("1"),
                unitPrice: new Prisma.Decimal("428571.43"),
                taxRate: new Prisma.Decimal("12.00"),
                lineSubtotal: new Prisma.Decimal("428571.43"),
                lineTax: new Prisma.Decimal("51428.57"),
                lineTotal: new Prisma.Decimal("480000.00"),
                position: 0,
              },
            ],
          },
        },
      });

      await prisma.documentSequence.upsert({
        where: { organizationId_kind: { organizationId: org.id, kind: SequenceKind.QUOTE } },
        update: { nextValue: 2 },
        create: { organizationId: org.id, kind: SequenceKind.QUOTE, nextValue: 2 },
      });
    }

    // Finance Expenses linked to Projects
    const firstProj = await prisma.project.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, companyId: true },
    });
    if (firstProj) {
      await prisma.expense.createMany({
        data: [
          {
            organizationId: org.id,
            projectId: firstProj.id,
            companyId: firstProj.companyId,
            createdById: lucas.id,
            title: "Cloud Staging & Dedicated Postgres Cluster",
            category: "Cloud Infrastructure",
            vendor: "Neon / AWS",
            amount: new Prisma.Decimal("24500.00"),
            currency: "PHP",
            billable: true,
            status: ExpenseStatus.UNBILLED,
            expenseDate: startOfUtcDay(addDays(now, -5)),
          },
          {
            organizationId: org.id,
            projectId: firstProj.id,
            companyId: firstProj.companyId,
            createdById: admin.id,
            title: "Enterprise SSL & Hardware Security Key Pack",
            category: "Security",
            vendor: "Yubico",
            amount: new Prisma.Decimal("12800.00"),
            currency: "PHP",
            billable: false,
            status: ExpenseStatus.NON_BILLABLE,
            expenseDate: startOfUtcDay(addDays(now, -9)),
          },
        ],
      });
    }
  }

  console.log(`Rich enterprise dataset seeded for organization "${org.slug}" (owner: owner@acme.test)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
