// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // === LOCATIONS ===
  const lakeShop = await prisma.location.upsert({
    where: { code: "LAKESHOP" },
    update: {},
    create: {
      name: "Lake Shop",
      code: "LAKESHOP",
      lat: 30.0000,    // TODO: replace with your real coords
      lng: -96.0000,
      radiusMeters: 300,
    },
  });

  const warehouseA = await prisma.location.upsert({
    where: { code: "WAREHOUSE_A" },
    update: {},
    create: {
      name: "Warehouse A",
      code: "WAREHOUSE_A",
      lat: 30.0050,    // TODO: replace these as needed
      lng: -96.0050,
      radiusMeters: 300,
    },
  });

  // === EMPLOYEES ===
  const pin1 = await bcrypt.hash("1234", 10);
  const pin2 = await bcrypt.hash("5678", 10);

  await prisma.user.upsert({
    where: { employeeCode: "ALI001" },
    update: {},
    create: {
      name: "Alice Example",
      employeeCode: "ALI001",
      role: Role.EMPLOYEE,
      pinHash: pin1,
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { employeeCode: "BOB001" },
    update: {},
    create: {
      name: "Bob Example",
      employeeCode: "BOB001",
      role: Role.EMPLOYEE,
      pinHash: pin2,
      active: true,
    },
  });

  // === MANAGER ===
  const managerPin = await bcrypt.hash("4321", 10);

  await prisma.user.upsert({
    where: { employeeCode: "MGR001" },
    update: {},
    create: {
      name: "Manager One",
      employeeCode: "MGR001",
      role: Role.MANAGER,
      pinHash: managerPin,
      email: "manager@example.com",
      active: true,
    },
  });

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
