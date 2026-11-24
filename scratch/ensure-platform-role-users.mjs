// scratch/ensure-platform-role-users.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

const encKey = process.env.FIELD_ENCRYPTION_KEY || 'hrm_platform_field_encryption_key_2026_super_secure!';
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(encKey).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

const roleConfigs = [
  { roleName: 'Platform Owner', email: 'platform.owner@cmsnbd.com', firstName: 'Platform', lastName: 'Owner' },
  { roleName: 'Platform Admin', email: 'platform.admin@cmsnbd.com', firstName: 'Platform', lastName: 'Admin' },
  { roleName: 'Billing Admin', email: 'billing.admin@cmsnbd.com', firstName: 'Billing', lastName: 'Admin' },
  { roleName: 'Support Agent', email: 'support.agent@cmsnbd.com', firstName: 'Support', lastName: 'Agent' },
  { roleName: 'Compliance Admin', email: 'compliance.admin@cmsnbd.com', firstName: 'Compliance', lastName: 'Admin' },
  { roleName: 'Read-Only Auditor', email: 'auditor@cmsnbd.com', firstName: 'Sarah', lastName: 'Chen' },
];

async function main() {
  const passwordHash = await bcrypt.hash('password', 12);
  const encryptedTotp = encrypt('JBSWY3DPEHPK3PXP');

  for (const cfg of roleConfigs) {
    const role = await prisma.platformRole.findUnique({ where: { name: cfg.roleName } });
    if (!role) {
      console.error('Role not found:', cfg.roleName);
      continue;
    }
    const user = await prisma.platformUser.upsert({
      where: { email: cfg.email },
      create: {
        email: cfg.email,
        passwordHash,
        firstName: cfg.firstName,
        lastName: cfg.lastName,
        roleId: role.id,
        isActive: true,
        totpSecretEncrypted: encryptedTotp,
        totpEnabled: true,
      },
      update: {
        passwordHash,
        roleId: role.id,
        isActive: true,
        totpSecretEncrypted: encryptedTotp,
        totpEnabled: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`Ensured user for ${cfg.roleName}: ${user.email} (ID: ${user.id})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
