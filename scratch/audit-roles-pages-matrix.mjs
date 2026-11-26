// scratch/audit-roles-pages-matrix.mjs
import { PLATFORM_NAV_GROUPS } from '../apps/platform/src/config/navigation.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mimic frontend hasPlatformPermission
function hasPlatformPermission(user, module, action = 'view') {
  if (!user) return false;
  if (user.roleName === 'Platform Owner') return true;

  const permissions = user.permissions ?? [];
  return permissions.some((p) => {
    if (p.module === 'platform' && p.action === 'manage') return true;
    if (p.module !== module) return false;
    if (p.action === action || p.action === 'manage') return true;
    if (action === 'view' && ['edit', 'create', 'delete'].includes(p.action)) return true;
    return false;
  });
}

async function main() {
  const roles = await prisma.platformRole.findMany({
    include: { permissions: true },
  });

  const allItems = [];
  for (const group of PLATFORM_NAV_GROUPS) {
    for (const item of group.items) {
      allItems.push({
        group: group.title,
        key: item.key,
        label: item.label,
        permission: item.permission,
      });
    }
  }

  console.log(`Auditing ${roles.length} roles across ${allItems.length} pages...\n`);

  const results = {};
  for (const role of roles) {
    results[role.name] = {};
    const user = {
      roleName: role.name,
      permissions: role.permissions.map((p) => ({ module: p.module, action: p.action })),
    };

    for (const page of allItems) {
      let allowed = true;
      if (page.permission) {
        allowed = hasPlatformPermission(user, page.permission.module, page.permission.action);
      }
      results[role.name][page.key] = allowed;
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main().finally(() => prisma.$disconnect());
