import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

export const RegisterSchema = z.object({
  name: z.string().min(3, "Nome muito curto").transform(val => {
    // Capitaliza primeira letra de cada nome
    return val.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
  }),
  email: z.string().email("Insira um e-mail válido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Insira um e-mail válido"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;