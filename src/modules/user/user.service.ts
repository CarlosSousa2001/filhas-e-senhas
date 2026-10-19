import { hashPassword } from '../../shared/auth/password.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt.js';
import { ForbiddenException } from '../../shared/errors/common-exceptions.js';
import { UserNotFoundException } from './user.errors.js';
import { userRepository } from './user.repository.js';

/**
 * Redefinição de senha por OWNER/ADMIN (seção 5.6 do contexto).
 * OWNER redefine de qualquer usuário; ADMIN de qualquer um, exceto do OWNER.
 * Atualiza password_changed_at: as sessões do usuário são derrubadas.
 */
export async function resetUserPassword(
  actor: AuthenticatedUser,
  userId: string,
  newPassword: string,
): Promise<void> {
  const target = await userRepository.findInOrganization(actor.organizationId, userId);
  if (!target) {
    throw new UserNotFoundException();
  }
  if (actor.role === 'ADMIN' && target.role === 'OWNER') {
    throw new ForbiddenException();
  }
  await userRepository.updatePassword(target.id, await hashPassword(newPassword), new Date());
}
