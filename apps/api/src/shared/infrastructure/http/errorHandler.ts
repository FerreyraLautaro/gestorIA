import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../domain/errors.js';
import { PROBLEM_CONTENT_TYPE, PROBLEM_TYPE, type ProblemDetails } from './problem.js';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

/** Builds the Problem Details body; `instance` is the request path. */
function problem(
  status: number,
  detail: string,
  instance: string,
  extensions: Pick<ProblemDetails, 'code' | 'errors'> = {},
): ProblemDetails {
  return {
    type: PROBLEM_TYPE,
    title: TITLES[status] ?? 'Error',
    status,
    detail,
    instance,
    ...extensions,
  };
}

function isMalformedJson(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  );
}

function toProblem(error: unknown, instance: string): ProblemDetails {
  if (error instanceof ValidationError) {
    return problem(400, error.message, instance, {
      code: error.code,
      errors: [{ field: error.field, message: error.message }],
    });
  }
  if (error instanceof ZodError) {
    const errors = error.issues.map((issue) => ({
      field: issue.path.map(String).join('.') || 'request',
      message: issue.message,
    }));
    return problem(400, 'The request is invalid.', instance, { code: 'VALIDATION_ERROR', errors });
  }
  if (isMalformedJson(error)) {
    return problem(400, 'The request body is not valid JSON.', instance);
  }
  if (error instanceof NotFoundError) {
    return problem(404, error.message, instance, { code: error.code });
  }
  if (error instanceof UnauthorizedError) {
    return problem(401, error.message, instance, { code: error.code });
  }
  if (error instanceof ConflictError) {
    return problem(409, error.message, instance, { code: error.code });
  }
  return problem(500, 'An unexpected error occurred.', instance);
}

/** Last middleware in the chain: turns any thrown or forwarded error into Problem Details. */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const body = toProblem(error, req.path);
  if (body.status === 500) {
    console.error('Unhandled error while handling request:', error);
  }
  res.status(body.status).set('Content-Type', PROBLEM_CONTENT_TYPE).json(body);
};

/** Mounted after every route: anything that reaches it matched no route. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body = problem(404, `Route ${req.method} ${req.path} was not found.`, req.path);
  res.status(404).set('Content-Type', PROBLEM_CONTENT_TYPE).json(body);
};
