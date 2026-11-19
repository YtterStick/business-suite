import {
  ContactLifecycleStage,
  DealStatus,
  MembershipRole,
  Prisma,
  PrismaClient,
  StageType,
} from "@prisma/client";

import { addDays, startOfUtcDay } from "../src/lib/dates";
import { hashPassword } from "../src/server/auth/password";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe-123!";
  const passwordHash = await hashPassword(password);

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

  const owner = await prisma.user.upsert({
    where: { email: "owner@acme.test" },
    update: { lastActiveOrgId: org.id },
    create: {
      email: "owner@acme.test",
      name: "Alex Morgan",
      passwordHash,
      emailVerifiedAt: new Date(),
      lastActiveOrgId: org.id,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@acme.test" },
    update: { lastActiveOrgId: org.id },
    create: {
      email: "admin@acme.test",
      name: "Priya Nair",
      passwordHash,
      emailVerifiedAt: new Date(),
      lastActiveOrgId: org.id,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "rep@acme.test" },
    update: { lastActiveOrgId: org.id },
    create: {
      email: "rep@acme.test",
      name: "Jordan Lee",
      passwordHash,
      emailVerifiedAt: new Date(),
      lastActiveOrgId: org.id,
    },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: owner.id } },
    update: { role: MembershipRole.OWNER },
    create: { organizationId: org.id, userId: owner.id, role: MembershipRole.OWNER },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    update: { role: MembershipRole.ADMIN },
    create: { organizationId: org.id, userId: admin.id, role: MembershipRole.ADMIN },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: member.id } },
    update: { role: MembershipRole.MEMBER },
    create: { organizationId: org.id, userId: member.id, role: MembershipRole.MEMBER },
  });

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

  const existingCompanies = await prisma.company.count({ where: { organizationId: org.id } });
  if (existingCompanies === 0) {
    const northstar = await prisma.company.create({
      data: {
        organizationId: org.id,
        ownerId: owner.id,
        name: "Northstar Logistics",
        domain: "northstar.example",
        industry: "Supply Chain",
        city: "Chicago",
        country: "US",
      },
    });

    const meridian = await prisma.company.create({
      data: {
        organizationId: org.id,
        ownerId: member.id,
        name: "Meridian BioLabs",
        domain: "meridianbio.example",
        industry: "Biotechnology",
        city: "Boston",
        country: "US",
      },
    });

    const summit = await prisma.company.create({
      data: {
        organizationId: org.id,
        ownerId: admin.id,
        name: "Summit FinTech",
        domain: "summitfintech.example",
        industry: "Financial Services",
        city: "Austin",
        country: "US",
      },
    });

    const c1 = await prisma.contact.create({
      data: {
        organizationId: org.id,
        companyId: northstar.id,
        ownerId: owner.id,
        firstName: "Elena",
        lastName: "Rostova",
        email: "elena@northstar.example",
        jobTitle: "VP of Operations",
        lifecycleStage: ContactLifecycleStage.PROSPECT,
      },
    });

    const c2 = await prisma.contact.create({
      data: {
        organizationId: org.id,
        companyId: meridian.id,
        ownerId: member.id,
        firstName: "Marcus",
        lastName: "Vance",
        email: "mvance@meridianbio.example",
        jobTitle: "Head of IT",
        lifecycleStage: ContactLifecycleStage.LEAD,
      },
    });

    const c3 = await prisma.contact.create({
      data: {
        organizationId: org.id,
        companyId: summit.id,
        ownerId: admin.id,
        firstName: "Claire",
        lastName: "Benton",
        email: "claire@summitfintech.example",
        jobTitle: "Chief Operating Officer",
        lifecycleStage: ContactLifecycleStage.CUSTOMER,
      },
    });

    const now = new Date();
    const discovery = stageByName.get("Discovery")!;
    const negotiation = stageByName.get("Negotiation")!;
    const closedWon = stageByName.get("Closed Won")!;

    await prisma.deal.create({
      data: {
        organizationId: org.id,
        pipelineId: pipeline.id,
        stageId: negotiation.id,
        companyId: northstar.id,
        contactId: c1.id,
        ownerId: owner.id,
        title: "Northstar Global ERP & CRM Suite",
        amount: new Prisma.Decimal("48000.00"),
        currency: "PHP",
        status: DealStatus.OPEN,
        probability: negotiation.probability,
        position: 1024,
        expectedCloseDate: startOfUtcDay(addDays(now, 14)),
        lineItems: {
          create: [
            {
              description: "Annual Enterprise Suite License (120 seats)",
              quantity: new Prisma.Decimal("120"),
              unitPrice: new Prisma.Decimal("300.00"),
              taxRate: new Prisma.Decimal("0"),
              position: 0,
            },
            {
              description: "Implementation & Data Migration",
              quantity: new Prisma.Decimal("1"),
              unitPrice: new Prisma.Decimal("12000.00"),
              taxRate: new Prisma.Decimal("0"),
              position: 1,
            },
          ],
        },
      },
    });

    await prisma.deal.create({
      data: {
        organizationId: org.id,
        pipelineId: pipeline.id,
        stageId: discovery.id,
        companyId: meridian.id,
        contactId: c2.id,
        ownerId: member.id,
        title: "Meridian Lab Compliance Portal",
        amount: new Prisma.Decimal("22500.00"),
        currency: "PHP",
        status: DealStatus.OPEN,
        probability: discovery.probability,
        position: 1024,
        expectedCloseDate: startOfUtcDay(addDays(now, 30)),
      },
    });

    await prisma.deal.create({
      data: {
        organizationId: org.id,
        pipelineId: pipeline.id,
        stageId: closedWon.id,
        companyId: summit.id,
        contactId: c3.id,
        ownerId: admin.id,
        title: "Summit FinTech Onboarding Suite",
        amount: new Prisma.Decimal("36000.00"),
        currency: "PHP",
        status: DealStatus.CLOSED_WON,
        probability: closedWon.probability,
        position: 1024,
        expectedCloseDate: startOfUtcDay(addDays(now, -2)),
        closedAt: addDays(now, -2),
      },
    });
  }

  console.log(`Seeded organization "${org.slug}" (owner: owner@acme.test)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
