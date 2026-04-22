import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// All values in cents
const celiLimits: Record<number, number> = {
  2009: 500000,
  2010: 500000,
  2011: 500000,
  2012: 500000,
  2013: 550000,
  2014: 550000,
  2015: 1000000,
  2016: 550000,
  2017: 550000,
  2018: 550000,
  2019: 600000,
  2020: 600000,
  2021: 600000,
  2022: 600000,
  2023: 650000,
  2024: 700000,
  2025: 700000,
  2026: 700000,
};

const reerLimits: Record<number, number> = {
  2009: 2150000,
  2010: 2200000,
  2011: 2267000,
  2012: 2297000,
  2013: 2382000,
  2014: 2450000,
  2015: 2493000,
  2016: 2541000,
  2017: 2600000,
  2018: 2623000,
  2019: 2658000,
  2020: 2723000,
  2021: 2783000,
  2022: 2932000,
  2023: 3078000,
  2024: 3156000,
  2025: 3249000,
  2026: 3381000,
};

const crcdLimits: Record<number, number> = {
  2018: 500000,
  2019: 500000,
  2020: 500000,
  2021: 500000,
  2022: 500000,
  2023: 500000,
  2024: 500000,
  2025: 500000,
  2026: 500000,
};

async function main() {
  console.log("Seeding CRA limits...");

  const entries: { year: number; type: string; limitCents: bigint }[] = [];

  for (const [year, cents] of Object.entries(celiLimits)) {
    entries.push({ year: Number(year), type: "CELI", limitCents: BigInt(cents) });
  }
  for (const [year, cents] of Object.entries(reerLimits)) {
    entries.push({ year: Number(year), type: "REER", limitCents: BigInt(cents) });
  }
  for (const [year, cents] of Object.entries(crcdLimits)) {
    entries.push({ year: Number(year), type: "CRCD", limitCents: BigInt(cents) });
  }

  for (const entry of entries) {
    await prisma.craLimit.upsert({
      where: { year_type: { year: entry.year, type: entry.type } },
      update: { limitCents: entry.limitCents },
      create: entry,
    });
  }

  console.log(`Seeded ${entries.length} CRA limit rows.`);
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
