import { z } from 'zod';

/**
 * Request schemas. Password policy matches the reference exactly: 8–128 chars, at
 * least one letter and one digit. Field names are wire-compatible with the SPA
 * (`email`, `password`, `refresh_token`, `new_password`, `display_name`).
 */
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must include at least one letter and one digit');

export const registerSchema = z.object({
  email: z.string().email(),
  password,
  display_name: z.string().max(80).optional(),
  locale: z.string().max(10).optional(),
  marketing_opt_in: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// refresh/logout accept the token in the body but prefer the httpOnly cookie.
export const refreshSchema = z.object({
  refresh_token: z.string().optional(),
});

export const logoutSchema = z.object({
  refresh_token: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: password,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password,
  name: z.string().max(120).optional(),
});

export const sessionParamsSchema = z.object({
  id: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
