import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

/** zValidator que responde { error: "mensaje legible" } con el primer problema encontrado. */
export const v = <Target extends keyof ValidationTargets, Schema extends ZodType>(target: Target, schema: Schema) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const msg = issue?.message && !issue.message.startsWith('Invalid') ? issue.message : `Dato no válido: ${issue?.path.join('.') || 'solicitud'}`
      return c.json({ error: msg }, 400)
    }
  })
