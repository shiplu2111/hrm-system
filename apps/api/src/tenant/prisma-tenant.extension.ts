import { Prisma } from '@prisma/client';
import {
  getTenantIdFromSession,
  isTenantScopeSkipped,
} from './tenant.context';
import { TENANT_SCOPED_MODELS } from './tenant.constants';

const READ_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findUnique',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_WHERE_OPERATIONS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

const CREATE_OPERATIONS = new Set(['create', 'createMany']);

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

function assertClientTenantIdNotOverridden(
  data: Record<string, unknown> | undefined,
  sessionTenantId: string,
): void {
  if (!data || typeof data !== 'object') {
    return;
  }

  const clientTenantId = data.tenantId;
  if (
    clientTenantId !== undefined &&
    clientTenantId !== sessionTenantId
  ) {
    throw new Error(
      'Client-supplied tenantId does not match authenticated session tenant',
    );
  }
}

function mergeTenantIntoWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> {
  return { ...where, tenantId };
}

function applyTenantScope(
  model: string,
  operation: string,
  args: QueryArgs,
  tenantId: string,
): QueryArgs {
  if (!TENANT_SCOPED_MODELS.has(model)) {
    return args;
  }

  if (READ_OPERATIONS.has(operation) || WRITE_WHERE_OPERATIONS.has(operation)) {
    args.where = mergeTenantIntoWhere(args.where, tenantId);
    return args;
  }

  if (operation === 'create') {
    assertClientTenantIdNotOverridden(args.data, tenantId);
    args.data = { ...args.data, tenantId };
    return args;
  }

  if (operation === 'createMany') {
    if (Array.isArray(args.data)) {
      args.data = args.data.map((row) => {
        const record = row as Record<string, unknown>;
        assertClientTenantIdNotOverridden(record, tenantId);
        return { ...record, tenantId };
      }) as unknown as Record<string, unknown>;
    }
    return args;
  }

  if (operation === 'upsert') {
    args.where = mergeTenantIntoWhere(args.where, tenantId);
    assertClientTenantIdNotOverridden(args.create, tenantId);
    args.create = { ...args.create, tenantId };
    return args;
  }

  return args;
}

export function createTenantScopeExtension() {
  return Prisma.defineExtension({
    name: 'tenantScope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = getTenantIdFromSession();

          if (!tenantId || isTenantScopeSkipped() || !model) {
            return query(args);
          }

          const scopedArgs = applyTenantScope(
            model,
            operation,
            args as QueryArgs,
            tenantId,
          );

          return query(scopedArgs);
        },
      },
    },
  });
}
