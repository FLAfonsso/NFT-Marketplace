import { z } from 'zod'

/** Campo de texto obrigatório com mensagem própria para o vazio (os schemas do contrato validam o resto). */
export const required = (message: string) => z.string().trim().min(1, message)

/** Texto opcional: vazio vira undefined antes de validar. */
export const optionalText = (schema: z.ZodType<string, string>) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(schema.optional())

const ENS_LABEL = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i
const stripEth = (value: string) => value.trim().replace(/\.eth$/i, '')

/** Nome ENS digitado sem o sufixo ".eth" (fixo ao lado do campo); sai completo e em minúsculas. */
export const ensLabel = (emptyMessage = 'Informe o nome ENS') =>
  required(emptyMessage)
    .transform(stripEth)
    .pipe(
      z
        .string()
        .regex(ENS_LABEL, 'Use letras, números ou hífen (ex.: ana)')
        .transform((label) => `${label.toLowerCase()}.eth`),
    )

/** Rótulo ENS (sem ".eth") para preencher o campo a partir de um nome salvo. */
export const ensLabelOf = (ens: string | null | undefined) => (ens ?? '').replace(/\.eth$/i, '')
