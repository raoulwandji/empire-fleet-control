import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existingAdmin) {
    console.log('Compte admin déjà existant, rien à faire.');
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@2026', 10);

  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      fullName: 'Administrateur Principal',
      role: 'ADMIN',
    },
  });

  console.log('Compte admin créé : identifiant="admin", mot de passe="Admin@2026"');
  console.log('IMPORTANT : changez ce mot de passe immédiatement après la première connexion.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
