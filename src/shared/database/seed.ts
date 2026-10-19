/**
 * Dados de exemplo para desenvolvimento: `npm run db:seed`.
 *
 * Cria o cenário de referência do MVP (docs/tasks/README.md): a organização
 * Nen Protocol System, com 3 departamentos, 2 balcões, 2 atendentes e o usuário
 * da TV do salão. Usa os próprios services da aplicação, então todas as regras valem.
 *
 * Credenciais APENAS para desenvolvimento local (nunca usar em produção).
 * Idempotente: se a organização de exemplo já existir, não cria nada.
 */
import { eq } from 'drizzle-orm';
import { env } from '../../env.js';
import { createDepartment } from '../../modules/department/department.service.js';
import { createOrganization } from '../../modules/organization/organization.service.js';
import {
  associateServicePoint,
  createServicePoint,
} from '../../modules/service-point/service-point.service.js';
import { createUser, grantDepartmentAccess } from '../../modules/user/user.service.js';
import type { AuthenticatedUser } from '../auth/jwt.js';
import { pool, db } from './client.js';
import { organizations } from './schema/index.js';

export const SEED = {
  document: '11222333000181',
  owner: { email: 'carlos@nen.dev', password: 'senha-dev-123' },
  password: 'senha-dev-123',
  departments: [
    { name: 'Técnico', prefix: 'TEC' },
    { name: 'Financeiro', prefix: 'FIN' },
    { name: 'Reparos', prefix: 'REP' },
  ],
  servicePoints: ['Balcão 1', 'Balcão 2'],
  users: [
    { name: 'Ana Balcão', username: 'ana.balcao1', role: 'ATTENDANT' as const },
    { name: 'Bruno Balcão', username: 'bruno.balcao2', role: 'ATTENDANT' as const },
    { name: 'TV do Salão', username: 'tv.salao', role: 'VIEWER' as const },
  ],
};

async function seed() {
  if (env.NODE_ENV === 'production') {
    throw new Error('O seed de desenvolvimento não pode rodar em produção.');
  }

  const [existing] = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.document, SEED.document))
    .limit(1);
  if (existing) {
    console.log(`Seed já aplicado (organização "${existing.slug}"). Nada a fazer.`);
    return;
  }

  const created = await createOrganization({
    organizationName: 'Nen Protocol System',
    document: SEED.document,
    ownerName: 'Carlos Sousa',
    phone: '11987654321',
    email: SEED.owner.email,
    password: SEED.owner.password,
    passwordConfirmation: SEED.owner.password,
    acceptedTerms: true,
  });

  const owner: AuthenticatedUser = {
    userId: created.owner.id,
    organizationId: created.organization.id,
    branchId: created.branch.id,
    role: 'OWNER',
  };

  const departments = [];
  for (const department of SEED.departments) {
    departments.push(await createDepartment(owner, department));
  }

  for (const name of SEED.servicePoints) {
    const servicePoint = await createServicePoint(owner, { name });
    for (const department of departments) {
      await associateServicePoint(owner, department.id, servicePoint.id);
    }
  }

  for (const user of SEED.users) {
    const createdUser = await createUser(owner, { ...user, password: SEED.password });
    for (const department of departments) {
      await grantDepartmentAccess(owner, createdUser.id, department.id);
    }
  }

  const slug = created.organization.slug;
  console.log(`
Seed aplicado: ${created.organization.name}

Dono (login por e-mail):       ${SEED.owner.email} / ${SEED.owner.password}
Funcionários (empresa "${slug}"):
${SEED.users.map((u) => `  ${u.role.padEnd(9)} ${u.username} / ${SEED.password}`).join('\n')}

Link de login dos funcionários: app.senhas.com/${slug}/login
Departamentos: ${SEED.departments.map((d) => `${d.name} (${d.prefix})`).join(', ')} + Atendimento (AT)
Balcões: ${SEED.servicePoints.join(', ')} (associados aos 3 departamentos)
`);
}

try {
  await seed();
} finally {
  await pool.end();
}
