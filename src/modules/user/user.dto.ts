import type { User, UserResponse } from './user.types.js';

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    active: user.active,
    branchId: user.branchId,
  };
}
