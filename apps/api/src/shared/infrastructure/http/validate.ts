import type { RequestHandler, Response } from 'express';
import { z } from 'zod';

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

/** Parsed (coerced, defaulted) output for every part that has a schema. */
export type Parsed<S extends Schemas> = {
  [K in keyof S]-?: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

const PARTS = ['body', 'query', 'params'] as const;

/**
 * Where parsed values are stored. Express 5 makes `req.query` a read-only getter,
 * so the raw request is never mutated; handlers read `res.locals` through `validated`.
 */
const LOCALS_KEY = 'validated';

/**
 * Validates the request parts that have a schema. Every failing part is reported
 * together as one `ZodError`, forwarded to the error handler (400 Problem Details).
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    const parsed: Record<string, unknown> = {};
    const issues: z.core.$ZodIssue[] = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        issues.push(...result.error.issues);
      }
    }

    if (issues.length > 0) {
      next(new z.ZodError(issues));
      return;
    }
    res.locals[LOCALS_KEY] = parsed;
    next();
  };
}

/**
 * Typed access to the values parsed by `validate`. Pass the same schemas given to
 * `validate` so TypeScript can infer the output types.
 */
export function validated<S extends Schemas>(res: Response, _schemas: S): Parsed<S> {
  return res.locals[LOCALS_KEY] as Parsed<S>;
}
