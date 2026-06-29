import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { readDb, writeDb, getAdmin } from "./db";

async function seed() {
  const email = process.env.ADMIN_EMAIL || "admin@iakiller.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const existing = getAdmin(email);
  if (existing) {
    console.log(`Admin ${email} already exists, skipping.`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const db = readDb();
  db.admins.push({
    id: uuidv4(),
    email,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  console.log(`Admin created: ${email}`);
}

seed().catch(console.error);
