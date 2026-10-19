import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../constants/index.js';

/** Política de senha para criação, troca e redefinição (8 a 128 caracteres). */
export const newPasswordSchema = z
  .string({ error: 'Informe a senha' })
  .min(MIN_PASSWORD_LENGTH, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(MAX_PASSWORD_LENGTH, `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres`);
