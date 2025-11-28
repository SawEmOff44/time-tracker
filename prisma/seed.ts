// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * EMPLOYEES TO SEED
 * ─────────────────────────────────────────────────────
 * You may freely edit this list. Running the seed again
 * will NOT overwrite real employee changes, because
 * update: {} is intentionally empty.
 */
const employees = [
  {
    name: "Kyle Rhinehart",
    employeeCode: "KYLE",
    email: "kyle@example.com",
    phone: "555-111-2222",
    role: Role.WORKER,
    active: true,
    hourlyRate: 28.0,
    salaryAnnnual: null,
    defaultPin: "1111",
  },
  {
    name: "Chris Rhinehart",
    employeeCode: "CHRIS",
    email: "chris@example.com",
    phone: "555-333-4444",
    role: Role.WORKER,
    active: true,
    hourlyRate: 24.50,
    salaryAnnnual: null,
    defaultPin: "2222",
  },
  {
    name: "Brennen Rhinehart",
    employeeCode: "ADMIN1",
    email: "brennen@example.com",
    phone: "555-999-0000",
    role: Role.ADMIN,
    active: true,
    hourlyRate: null,
    salaryAnnnual: 65000,
    defaultPin: "9999",
  },
];

/**
 * LOCATIONS TO SEED
 */
const locations = [
  {
    name: "Lake Shop",
    code: "LAKESHOP",
    lat: 33.8223,
    lng: -96.6662,
    radiusMeters: 75,
    active: true,
  },
];

async function main() {
  console.log("🌱 Seeding database…");

  // ────────────────────────────────────────────────
  // EMPLOYEES
  // ────────────────────────────────────────────────
  for (const emp of employees) {
    const pinHash = await bcrypt.hash(emp.defaultPin, 10);

    const created = await prisma.user.upsert({
      where: { employeeCode: emp.employeeCode },
      update: {}, // <── preserves in‑app edits, does NOT override
      create: {
        name: emp.name,
        employeeCode: emp.employeeCode,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        active: emp.active,
        hourlyRate: emp.hourlyRate,
        salaryAnnnual: emp.salaryAnnnual,
        pinHash,
      },
    });

    console.log(
      `  - ${created.name} (${created.employeeCode}) | ` +
        (created.hourlyRate != null
          ? `$${created.hourlyRate.toFixed(2)}/hr`
          : created.salaryAnnnual != null
          ? `$${created.salaryAnnnual.toFixed(0)}/yr`
          : "NO PAY SET") +
        ` | PIN: ${emp.defaultPin}`
    );
  }

  // ────────────────────────────────────────────────
  // LOCATIONS
  // ────────────────────────────────────────────────
  for (const loc of locations) {
    await prisma.location.upsert({
      where: { code: loc.code },
      update: {},
      create: {
        name: loc.name,
        code: loc.code,
        lat: loc.lat,
        lng: loc.lng,
        radiusMeters: loc.radiusMeters,
        active: loc.active,
      },
    });

    console.log(`  - Location: ${loc.name} (${loc.code})`);
  }

  console.log("✅ Seeding complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });