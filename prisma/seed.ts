import { PrismaClient } from "@prisma/client";
import { generateAndSaveRoster } from "../src/lib/scheduler/service";
import { parseUTCDate } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Smart Roster database...");

  // Clean slate for idempotent re-seeding
  await prisma.rosterChangeLog.deleteMany();
  await prisma.rosterConflict.deleteMany();
  await prisma.rosterAllocation.deleteMany();
  await prisma.rosterEntry.deleteMany();
  await prisma.roster.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.publicHoliday.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.brandProcessConfig.deleteMany();
  await prisma.pod.updateMany({ data: { leadId: null } });
  await prisma.employee.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.process.deleteMany();
  await prisma.pod.deleteMany();

  // 1. Processes
  const [cs, acc, ndr, ret] = await Promise.all([
    prisma.process.create({
      data: {
        code: "CS",
        name: "Customer Support",
        description: "Omnichannel ticket, chat, and voice customer care",
      },
    }),
    prisma.process.create({
      data: {
        code: "ACC",
        name: "Abandoned Cart Conversions",
        description: "Proactive outbound recovery for incomplete D2C checkouts",
      },
    }),
    prisma.process.create({
      data: {
        code: "NDR",
        name: "Non-Delivery Report Management",
        description: "Courier exception coordination and re-attempt resolution",
      },
    }),
    prisma.process.create({
      data: {
        code: "RET",
        name: "Retention & Loyalty",
        description: "Subscription renewals, VIP follow-ups, and win-back flows",
      },
    }),
  ]);

  // 2. Operational Pods
  const [podAlpha, podBeta, podGamma, podDelta] = await Promise.all([
    prisma.pod.create({
      data: {
        name: "Pod Alpha — Beauty & Wellness",
        description: "High-touch skincare, wellness, and personal care D2C brands",
      },
    }),
    prisma.pod.create({
      data: {
        name: "Pod Beta — Pantry & Lifestyle",
        description: "Food, beverage, homeware, and pet nutrition D2C accounts",
      },
    }),
    prisma.pod.create({
      data: {
        name: "Pod Gamma — Apparel & Gear",
        description: "Footwear, eyewear, activewear, and kids apparel brands",
      },
    }),
    prisma.pod.create({
      data: {
        name: "Pod Delta — Tech & Nutrition",
        description: "Multi-agent electronics and high-velocity sports nutrition",
      },
    }),
  ]);

  // 3. Employees (34 total across 4 pods: 4 Pod Leads, 4 Backup Floats, 26 Agents)
  const employeeSpecs = [
    // Pod Alpha (9)
    { key: "e1", name: "Aarav Mehta", email: "aarav@ops.local", role: "POD_LEAD", podId: podAlpha.id, off: 0, maxDays: 6 },
    { key: "e2", name: "Ananya Rao", email: "ananya@ops.local", role: "AGENT", podId: podAlpha.id, off: 0, maxDays: 6 },
    { key: "e3", name: "Ishaan Kulkarni", email: "ishaan@ops.local", role: "AGENT", podId: podAlpha.id, off: 0, maxDays: 6 },
    { key: "e4", name: "Diya Sharma", email: "diya@ops.local", role: "AGENT", podId: podAlpha.id, off: 2, maxDays: 6 },
    { key: "e5", name: "Kavya Menon", email: "kavya@ops.local", role: "AGENT", podId: podAlpha.id, off: 0, maxDays: 6 },
    { key: "e6", name: "Nikhil Joshi", email: "nikhil@ops.local", role: "AGENT", podId: podAlpha.id, off: 0, maxDays: 6 },
    { key: "e7", name: "Rhea Kapoor", email: "rhea@ops.local", role: "AGENT", podId: podAlpha.id, off: 3, maxDays: 6 },
    { key: "e8", name: "Tanvi Deshmukh", email: "tanvi@ops.local", role: "AGENT", podId: podAlpha.id, off: 0, maxDays: 6 },
    { key: "e9", name: "Siddharth Verma", email: "siddharth@ops.local", role: "BACKUP_FLOAT", podId: podAlpha.id, off: 4, maxDays: 6 },

    // Pod Beta (9)
    { key: "e10", name: "Priya Nair", email: "priya@ops.local", role: "POD_LEAD", podId: podBeta.id, off: 0, maxDays: 6 },
    { key: "e11", name: "Meera Iyer", email: "meera@ops.local", role: "AGENT", podId: podBeta.id, off: 0, maxDays: 6 },
    { key: "e12", name: "Aditya Bansal", email: "aditya@ops.local", role: "AGENT", podId: podBeta.id, off: 0, maxDays: 6 },
    { key: "e13", name: "Sneha Pillai", email: "sneha@ops.local", role: "AGENT", podId: podBeta.id, off: 1, maxDays: 6 },
    { key: "e14", name: "Varun Malhotra", email: "varun@ops.local", role: "AGENT", podId: podBeta.id, off: 0, maxDays: 6 },
    { key: "e15", name: "Pooja Hegde", email: "pooja@ops.local", role: "AGENT", podId: podBeta.id, off: 0, maxDays: 6 },
    { key: "e16", name: "Devansh Saxena", email: "devansh@ops.local", role: "AGENT", podId: podBeta.id, off: 2, maxDays: 6 },
    { key: "e17", name: "Nisha Chatterjee", email: "nisha@ops.local", role: "AGENT", podId: podBeta.id, off: 0, maxDays: 6 },
    { key: "e18", name: "Karan Gill", email: "karan@ops.local", role: "BACKUP_FLOAT", podId: podBeta.id, off: 3, maxDays: 6 },

    // Pod Gamma (8)
    { key: "e19", name: "Ritika Sen", email: "ritika@ops.local", role: "POD_LEAD", podId: podGamma.id, off: 0, maxDays: 6 },
    { key: "e20", name: "Kabir Anand", email: "kabir@ops.local", role: "AGENT", podId: podGamma.id, off: 0, maxDays: 6 },
    { key: "e21", name: "Sana Sheikh", email: "sana@ops.local", role: "AGENT", podId: podGamma.id, off: 0, maxDays: 6 },
    { key: "e22", name: "Arjun Khanna", email: "arjun@ops.local", role: "AGENT", podId: podGamma.id, off: 4, maxDays: 6 },
    { key: "e23", name: "Shruti Kulkarni", email: "shruti@ops.local", role: "AGENT", podId: podGamma.id, off: 0, maxDays: 6 },
    { key: "e24", name: "Manav Patel", email: "manav@ops.local", role: "AGENT", podId: podGamma.id, off: 1, maxDays: 6 },
    { key: "e25", name: "Simran Kaur", email: "simran@ops.local", role: "AGENT", podId: podGamma.id, off: 0, maxDays: 6 },
    { key: "e26", name: "Harshvardhan Roy", email: "harsh@ops.local", role: "BACKUP_FLOAT", podId: podGamma.id, off: 5, maxDays: 6 },

    // Pod Delta (8)
    { key: "e27", name: "Zoya Mirza", email: "zoya@ops.local", role: "POD_LEAD", podId: podDelta.id, off: 0, maxDays: 6 },
    { key: "e28", name: "Rohan Sinha", email: "rohan@ops.local", role: "AGENT", podId: podDelta.id, off: 0, maxDays: 6 },
    { key: "e29", name: "Tara Sengupta", email: "tara@ops.local", role: "AGENT", podId: podDelta.id, off: 2, maxDays: 6 },
    { key: "e30", name: "Pranav Nambiar", email: "pranav@ops.local", role: "AGENT", podId: podDelta.id, off: 0, maxDays: 6 },
    { key: "e31", name: "Aditi Chawla", email: "aditi@ops.local", role: "AGENT", podId: podDelta.id, off: 3, maxDays: 6 },
    { key: "e32", name: "Yashwant Reddy", email: "yashwant@ops.local", role: "AGENT", podId: podDelta.id, off: 0, maxDays: 6 },
    { key: "e33", name: "Lavanya Krishnan", email: "lavanya@ops.local", role: "AGENT", podId: podDelta.id, off: 1, maxDays: 6 },
    { key: "e34", name: "Omkar Bhosale", email: "omkar@ops.local", role: "BACKUP_FLOAT", podId: podDelta.id, off: 4, maxDays: 6 },
  ];

  const empMap: Record<string, string> = {};
  for (const spec of employeeSpecs) {
    const created = await prisma.employee.create({
      data: {
        name: spec.name,
        email: spec.email,
        role: spec.role,
        podId: spec.podId,
        preferredOffDay: spec.off,
        maxWeeklyWorkdays: spec.maxDays,
        shiftWindow: "STANDARD",
      },
    });
    empMap[spec.key] = created.id;
  }

  // Assign Pod Leads
  await Promise.all([
    prisma.pod.update({ where: { id: podAlpha.id }, data: { leadId: empMap.e1 } }),
    prisma.pod.update({ where: { id: podBeta.id }, data: { leadId: empMap.e10 } }),
    prisma.pod.update({ where: { id: podGamma.id }, data: { leadId: empMap.e19 } }),
    prisma.pod.update({ where: { id: podDelta.id }, data: { leadId: empMap.e27 } }),
  ]);

  // 4. 20 D2C Brands (16 Single-Resource = 80%, 4 Multi-Resource = 20%)
  const brandDefinitions = [
    // 16 Single-Resource Brands (80%)
    { key: "b1", name: "Velvet Botanics", code: "VBOT", cat: "Skincare" },
    { key: "b2", name: "Kaya Roasters", code: "KAYA", cat: "Coffee" },
    { key: "b3", name: "Aura Athletics", code: "AURA", cat: "Fitness" },
    { key: "b4", name: "Solstice Skincare", code: "SOLS", cat: "Beauty" },
    { key: "b5", name: "Nimbus Sleep", code: "NIMB", cat: "Home" },
    { key: "b6", name: "Pebble Pets", code: "PEBL", cat: "Pet Care" },
    { key: "b7", name: "Driftwood Tea", code: "DRFT", cat: "Beverage" },
    { key: "b8", name: "Cinder Candles", code: "CIND", cat: "Home Fragrance" },
    { key: "b9", name: "Loom & Linen", code: "LOOM", cat: "Textiles" },
    { key: "b10", name: "Saffron Pantry", code: "SAFF", cat: "Gourmet Food" },
    { key: "b11", name: "Bramble Kids", code: "BRAM", cat: "Apparel" },
    { key: "b12", name: "Tonic Hydration", code: "TONI", cat: "Wellness" },
    { key: "b13", name: "Verve Eyewear", code: "VERV", cat: "Eyewear" },
    { key: "b14", name: "Hearth & Clay", code: "HEAR", cat: "Ceramics" },
    { key: "b15", name: "Moss & Co", code: "MOSS", cat: "Gardening" },
    { key: "b16", name: "Zest Organics", code: "ZEST", cat: "Personal Care" },
    // 4 Multi-Resource Brands (20%)
    { key: "b17", name: "Vanguard Electronics", code: "VANG", cat: "Consumer Tech" },
    { key: "b18", name: "UrbanStride Footwear", code: "URBN", cat: "Footwear" },
    { key: "b19", name: "Lumina Beauty", code: "LUMI", cat: "Cosmetics" },
    { key: "b20", name: "Pulse Nutrition", code: "PULS", cat: "Supplements" },
  ];

  const brandMap: Record<string, string> = {};
  for (const b of brandDefinitions) {
    const created = await prisma.brand.create({
      data: {
        name: b.name,
        code: b.code,
        category: b.cat,
      },
    });
    brandMap[b.key] = created.id;
  }

  // 5. Brand Process Operating Rules (Diverse rules + intra-brand process divergence)
  const configRows: Array<{
    brandId: string;
    processId: string;
    operatingRule: string;
    minStaff: number;
    dayOverrides?: string;
  }> = [
    // Single-resource brands
    { brandId: brandMap.b1, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b1, processId: acc.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b1, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Process divergence: CS runs 365 days, ACC/NDR closed Sundays & holidays
    { brandId: brandMap.b2, processId: cs.id, operatingRule: "EVERY_DAY", minStaff: 1 },
    { brandId: brandMap.b2, processId: acc.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Process divergence: CS daily except holidays, NDR Mon-Sat
    { brandId: brandMap.b3, processId: cs.id, operatingRule: "DAILY_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b3, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    { brandId: brandMap.b4, processId: cs.id, operatingRule: "EVERY_DAY", minStaff: 1 },
    { brandId: brandMap.b4, processId: ret.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    { brandId: brandMap.b5, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b5, processId: acc.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    { brandId: brandMap.b6, processId: cs.id, operatingRule: "DAILY_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b6, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Cross-brand pair 1 (Meera handles Driftwood + Cinder)
    { brandId: brandMap.b7, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b8, processId: acc.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    { brandId: brandMap.b9, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b9, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Saffron Pantry (EVERY_DAY single-resource -> demonstrates intentional conflict on leave!)
    { brandId: brandMap.b10, processId: cs.id, operatingRule: "EVERY_DAY", minStaff: 1 },
    { brandId: brandMap.b10, processId: acc.id, operatingRule: "DAILY_NO_HOLIDAYS", minStaff: 1 },

    { brandId: brandMap.b11, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b11, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Cross-brand pair 2 (Kabir handles Tonic + Verve)
    { brandId: brandMap.b12, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b13, processId: acc.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    { brandId: brandMap.b14, processId: cs.id, operatingRule: "DAILY_NO_HOLIDAYS", minStaff: 1 },

    // Cross-brand pair 3 (Sana handles Moss + Zest)
    { brandId: brandMap.b15, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b16, processId: ret.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Multi-resource Brand 1: Vanguard Electronics (3 employees, shared CS + split ACC/NDR, minStaff=2 on Mon/Sat)
    {
      brandId: brandMap.b17,
      processId: cs.id,
      operatingRule: "EVERY_DAY",
      minStaff: 1,
      dayOverrides: JSON.stringify({ dayMinStaff: { "1": 2, "6": 2 } }),
    },
    { brandId: brandMap.b17, processId: acc.id, operatingRule: "DAILY_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b17, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Multi-resource Brand 2: UrbanStride Footwear (3 employees, split processes)
    { brandId: brandMap.b18, processId: cs.id, operatingRule: "EVERY_DAY", minStaff: 1 },
    { brandId: brandMap.b18, processId: acc.id, operatingRule: "DAILY_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b18, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Multi-resource Brand 3: Lumina Beauty (2 employees sharing CS, splitting ACC & RET)
    { brandId: brandMap.b19, processId: cs.id, operatingRule: "EVERY_DAY", minStaff: 1 },
    { brandId: brandMap.b19, processId: acc.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
    { brandId: brandMap.b19, processId: ret.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },

    // Multi-resource Brand 4: Pulse Nutrition (3 employees: 2 shared on CS minStaff=2 Mon-Sat + 1 on NDR)
    { brandId: brandMap.b20, processId: cs.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 2 },
    { brandId: brandMap.b20, processId: ndr.id, operatingRule: "NO_SUNDAYS_NO_HOLIDAYS", minStaff: 1 },
  ];

  await prisma.brandProcessConfig.createMany({ data: configRows });

  // 6. Assignments (matching realistic 80% single-resource + 20% multi-resource + cross-brand + backups)
  const assignmentsData: Array<{
    employeeId: string;
    brandId: string;
    processId: string;
    allocationType: string;
    capacityWeight: number;
    priority: number;
  }> = [
    // Velvet Botanics -> e2 (single dedicated)
    { employeeId: empMap.e2, brandId: brandMap.b1, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },
    { employeeId: empMap.e2, brandId: brandMap.b1, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.3, priority: 1 },
    { employeeId: empMap.e2, brandId: brandMap.b1, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 0.3, priority: 1 },

    // Kaya Roasters -> e3 (single dedicated) + e9 (Pod Alpha float backup)
    { employeeId: empMap.e3, brandId: brandMap.b2, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e3, brandId: brandMap.b2, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },
    { employeeId: empMap.e9, brandId: brandMap.b2, processId: cs.id, allocationType: "BACKUP", capacityWeight: 0.5, priority: 2 },

    // Aura Athletics -> e4 (single dedicated, prefers Tue off -> overridden by Mon-Sat NDR!)
    { employeeId: empMap.e4, brandId: brandMap.b3, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e4, brandId: brandMap.b3, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },
    { employeeId: empMap.e9, brandId: brandMap.b3, processId: cs.id, allocationType: "BACKUP", capacityWeight: 0.5, priority: 2 },

    // Solstice Skincare -> e5
    { employeeId: empMap.e5, brandId: brandMap.b4, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.7, priority: 1 },
    { employeeId: empMap.e5, brandId: brandMap.b4, processId: ret.id, allocationType: "PRIMARY", capacityWeight: 0.3, priority: 1 },

    // Nimbus Sleep -> e6
    { employeeId: empMap.e6, brandId: brandMap.b5, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e6, brandId: brandMap.b5, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },

    // Pebble Pets -> e7
    { employeeId: empMap.e7, brandId: brandMap.b6, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e7, brandId: brandMap.b6, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },

    // Cross-brand pair 1: e11 (Meera) -> Driftwood Tea + Cinder Candles
    { employeeId: empMap.e11, brandId: brandMap.b7, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },
    { employeeId: empMap.e11, brandId: brandMap.b8, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },

    // Loom & Linen -> e12
    { employeeId: empMap.e12, brandId: brandMap.b9, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e12, brandId: brandMap.b9, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },

    // Saffron Pantry -> e13 (sole owner, EVERY_DAY CS -> deliberate conflict demo when on leave!)
    { employeeId: empMap.e13, brandId: brandMap.b10, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e13, brandId: brandMap.b10, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },

    // Bramble Kids -> e14
    { employeeId: empMap.e14, brandId: brandMap.b11, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e14, brandId: brandMap.b11, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },

    // Cross-brand pair 2: e20 (Kabir) -> Tonic Hydration + Verve Eyewear
    { employeeId: empMap.e20, brandId: brandMap.b12, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },
    { employeeId: empMap.e20, brandId: brandMap.b13, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },

    // Hearth & Clay -> e15
    { employeeId: empMap.e15, brandId: brandMap.b14, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 1 },

    // Cross-brand pair 3: e21 (Sana) -> Moss & Co + Zest Organics
    { employeeId: empMap.e21, brandId: brandMap.b15, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },
    { employeeId: empMap.e21, brandId: brandMap.b16, processId: ret.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },

    // Multi-Resource Brand 1: Vanguard Electronics (e28 + e29 share CS, e30 covers ACC + NDR)
    { employeeId: empMap.e28, brandId: brandMap.b17, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 1 },
    { employeeId: empMap.e29, brandId: brandMap.b17, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 2 },
    { employeeId: empMap.e30, brandId: brandMap.b17, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },
    { employeeId: empMap.e30, brandId: brandMap.b17, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 0.5, priority: 1 },

    // Multi-Resource Brand 2: UrbanStride Footwear (e22=CS, e23=ACC, e24=NDR)
    { employeeId: empMap.e22, brandId: brandMap.b18, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 1 },
    { employeeId: empMap.e23, brandId: brandMap.b18, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 1 },
    { employeeId: empMap.e24, brandId: brandMap.b18, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 1 },
    { employeeId: empMap.e26, brandId: brandMap.b18, processId: cs.id, allocationType: "BACKUP", capacityWeight: 0.5, priority: 2 },

    // Multi-Resource Brand 3: Lumina Beauty (e8 + e16 share CS; e8 also ACC, e16 also RET)
    { employeeId: empMap.e8, brandId: brandMap.b19, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 1 },
    { employeeId: empMap.e8, brandId: brandMap.b19, processId: acc.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },
    { employeeId: empMap.e16, brandId: brandMap.b19, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 0.6, priority: 2 },
    { employeeId: empMap.e16, brandId: brandMap.b19, processId: ret.id, allocationType: "PRIMARY", capacityWeight: 0.4, priority: 1 },

    // Multi-Resource Brand 4: Pulse Nutrition (e31 + e32 both on CS minStaff=2, e33 on NDR)
    { employeeId: empMap.e31, brandId: brandMap.b20, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 1 },
    { employeeId: empMap.e32, brandId: brandMap.b20, processId: cs.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 2 },
    { employeeId: empMap.e33, brandId: brandMap.b20, processId: ndr.id, allocationType: "PRIMARY", capacityWeight: 1.0, priority: 1 },
    { employeeId: empMap.e34, brandId: brandMap.b20, processId: cs.id, allocationType: "BACKUP", capacityWeight: 0.5, priority: 3 },
  ];

  await prisma.assignment.createMany({ data: assignmentsData });

  // 7. Public Holidays (December 2026)
  await prisma.publicHoliday.createMany({
    data: [
      { date: parseUTCDate("2026-12-25"), name: "Christmas Day", scope: "GLOBAL" },
      { date: parseUTCDate("2026-12-26"), name: "Boxing Day", scope: "GLOBAL" },
      { date: parseUTCDate("2026-12-31"), name: "New Year's Eve", scope: "GLOBAL" },
    ],
  });

  // 8. Pre-seeded Leaves & Comp-Offs (Demonstrating both backup coverage & realistic conflicts)
  await prisma.timeOff.createMany({
    data: [
      // Covered cleanly by Pod Alpha float e9
      {
        employeeId: empMap.e3,
        date: parseUTCDate("2026-12-10"),
        type: "PLANNED_LEAVE",
        status: "APPROVED",
        reason: "Personal leave — covered by Pod Alpha float",
      },
      // Cross-brand cascading gap: Meera (Driftwood + Cinder) on Dec 22
      {
        employeeId: empMap.e11,
        date: parseUTCDate("2026-12-22"),
        type: "COMP_OFF",
        status: "APPROVED",
        reason: "Comp-off for Black Friday campaign",
      },
      // Multi-resource Brand (Pulse Nutrition): Aditi off on Dec 16 -> float e34 covers or flags if busy
      {
        employeeId: empMap.e31,
        date: parseUTCDate("2026-12-16"),
        type: "PLANNED_LEAVE",
        status: "APPROVED",
        reason: "Medical appointment",
      },
      // Saffron Pantry (single-resource EVERY_DAY) on Dec 14-15 -> shows clear gap + recommendations
      {
        employeeId: empMap.e13,
        date: parseUTCDate("2026-12-14"),
        type: "PLANNED_LEAVE",
        status: "APPROVED",
        reason: "Planned family travel",
      },
      {
        employeeId: empMap.e13,
        date: parseUTCDate("2026-12-15"),
        type: "PLANNED_LEAVE",
        status: "APPROVED",
        reason: "Planned family travel",
      },
      // Pending request (ignored by locked unavailability until approved)
      {
        employeeId: empMap.e22,
        date: parseUTCDate("2026-12-21"),
        type: "PLANNED_LEAVE",
        status: "PENDING",
        reason: "Pending approval",
      },
    ],
  });

  // 9. Generate December 2026 Roster so evaluators immediately land on populated views
  const result = await generateAndSaveRoster(12, 2026);
  console.log(
    `Seeded 34 employees, 4 pods, 20 brands, 4 processes, and December 2026 roster (${result.stats.coveredDemandSlots}/${result.stats.totalDemandSlots} slots covered, ${result.stats.hardConflicts} hard & ${result.stats.softConflicts} soft conflicts).`
  );
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
