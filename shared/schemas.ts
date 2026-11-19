import { z } from 'zod'

/** Esquemas Zod compartidos: validan igual en el formulario y en el servidor. */

export const speciesSchema = z.enum(['perro', 'gato', 'otro'])
export const conditionSchema = z.enum(['saludable', 'herido', 'desnutrido', 'urgente'])
export const needSchema = z.enum(['alimento', 'veterinario', 'traslado', 'hogar', 'medicamentos', 'donacion'])
export const needStateSchema = z.enum(['pendiente', 'en_camino', 'cubierto'])
export const statusSchema = z.enum(['reportado', 'en_atencion', 'rescatado', 'adopcion', 'cerrado'])

const email = z.string().trim().toLowerCase().email('Correo no válido').max(120)
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100)
const name = z.string().trim().min(2, 'Escribe tu nombre').max(40)

export const registerSchema = z.object({ name, email, password })
export const loginSchema = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña').max(100) })
export const updateMeSchema = z.object({ name: name.optional(), avatarKey: z.string().max(200).nullable().optional() })
export const changePasswordSchema = z.object({ current: z.string().min(1).max(100), next: password })

export const needItemSchema = z.object({
  need: needSchema,
  detail: z.string().trim().max(120).nullable().optional(),
  state: needStateSchema.default('pendiente'),
})

export const createCaseSchema = z.object({
  name: z.string().trim().max(30).default(''),
  species: speciesSchema,
  condition: conditionSchema,
  needs: z.array(needSchema).min(1, 'Elige al menos una necesidad').max(6),
  description: z.string().trim().max(280).default(''),
  photos: z.array(z.string().max(200)).min(1, 'Agrega al menos una foto').max(4),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(1).max(160),
  anonymous: z.boolean().default(false),
})

export const updateCaseSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  sex: z.enum(['Hembra', 'Macho']).nullable().optional(),
  profile: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(500).optional(),
  medicalNote: z.string().trim().max(300).nullable().optional(),
  condition: conditionSchema.optional(),
  donationGoal: z.number().int().min(10_000).max(50_000_000).optional(),
})

export const statusChangeSchema = z.object({ status: statusSchema, detail: z.string().trim().max(200).optional() })
export const needsUpdateSchema = z.object({ needs: z.array(needItemSchema).max(6) })
export const helpSchema = z.object({ helpType: z.string().trim().min(2).max(60) })
export const flagSchema = z.object({ reason: z.enum(['falso', 'duplicado', 'inapropiado', 'resuelto']) })
export const commentSchema = z.object({ body: z.string().trim().min(1, 'Escribe un comentario').max(500) })

export const donationSchema = z.object({
  amount: z.number().int().min(1_000, 'El monto mínimo es $1.000').max(50_000_000),
  frequency: z.enum(['unica', 'mensual']),
  destination: z.string().trim().min(1).max(60),
  method: z.string().trim().min(1).max(40),
  caseId: z.number().int().positive().optional(),
})

export const adminUserUpdateSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  verified: z.boolean().optional(),
  disabled: z.boolean().optional(),
})
export const adminCaseUpdateSchema = z.object({
  hidden: z.boolean().optional(),
  hiddenReason: z.string().trim().max(120).nullable().optional(),
  verified: z.boolean().optional(),
})
export const campaignSchema = z.object({
  title: z.string().trim().min(3).max(80),
  goal: z.number().int().min(100_000).max(10_000_000_000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})
