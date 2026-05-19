import { PrismaClient } from "@prisma/client";
import * as argon from "argon2";

const prisma = new PrismaClient();

async function main() {
  const username = "admin1";
  const password = "admin123";
  const email = "admin1@example.com";

  // Check if admin1 already exists
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    console.log(`User ${username} already exists!`);
    return;
  }

  const hashedPassword = await argon.hash(password);

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      isAdmin: true,
      totpVerified: true,
    }
  });

  console.log(`Successfully created administrator user: ${username} with ID ${newUser.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
