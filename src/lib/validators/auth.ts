import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const setupSchema = z
  .object({
    email: z.email("Invalid email"),
    displayName: z.string().min(1, "Display name is required"),
    birthYear: z.number().int().min(1940).max(2010),
    password: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string(),
    locale: z.enum(["fr-CA", "en-CA"]),
    currentSalaryCents: z.bigint().positive("Salary must be positive"),
    targetRetirementAge: z.number().int().min(40).max(80),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export const createUserSchema = z.object({
  email: z.email("Invalid email"),
  displayName: z.string().min(1, "Display name is required"),
  birthYear: z.number().int().min(1940).max(2010),
  temporaryPassword: z.string().min(12, "Password must be at least 12 characters"),
  currentSalaryCents: z.bigint().positive("Salary must be positive"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
