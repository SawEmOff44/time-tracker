// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Example seed user (adjust as needed)
  await prisma.user.upsert({
    where: { employeeCode: "1234" },
    update: {},
    create: {
      name: "Test User",
      employeeCode: "1234",
      pinHash: "1111",   // plaintext pin for now
      role: Role.EMPLOYEE,
      active: true,
    },
  });

  // Example seed location
  await prisma.location.upsert({
    where: { code: "LAKESHOP" },
    update: {},
    create: {
      name: "Lake Shop",
      code: "LAKESHOP",
      lat: 33.8223,
      lng: -96.6662,
      radiusMeters: 75,
      active: true,
    },
  });

  console.log("Seeding complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
