import { z } from 'zod';

/** Media type of RFC 9457 Problem Details responses. */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * The API defines no per-problem type URIs, so every problem uses the RFC 9457
 * default `about:blank`; clients branch on `status` and `code` instead.
 */
export const PROBLEM_TYPE = 'about:blank';

export const FieldErrorSchema = z
  .object({
    field: z.string().meta({ example: 'price' }),
    message: z.string().meta({ example: 'price must be an integer greater than or equal to 0' }),
  })
  .meta({ id: 'FieldError' });

/** RFC 9457 Problem Details body, with the `code` and `errors` extensions. */
export const ProblemDetailsSchema = z
  .object({
    type: z.string().meta({ example: PROBLEM_TYPE }),
    title: z.string().meta({ example: 'Bad Request' }),
    status: z.number().int().meta({ example: 400 }),
    detail: z.string().meta({ example: 'price must be an integer greater than or equal to 0' }),
    instance: z.string().optional().meta({ example: '/products' }),
    code: z.string().optional().meta({ example: 'VALIDATION_ERROR' }),
    errors: z.array(FieldErrorSchema).optional(),
  })
  .meta({ id: 'ProblemDetails' });

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
