import { Router } from 'express';
import { z } from 'zod';
import type { AccessTokenService } from '../../../accounts/domain/AccessTokenService.js';
import {
  authenticatedOwnerId,
  requireAuth,
} from '../../../accounts/infrastructure/http/requireAuth.js';
import { openApiRegistry, problemResponse } from '../../../shared/infrastructure/http/openapi.js';
import { validate, validated } from '../../../shared/infrastructure/http/validate.js';
import type { CreateProduct } from '../../application/CreateProduct.js';
import type { DeactivateProduct } from '../../application/DeactivateProduct.js';
import type { GetProduct } from '../../application/GetProduct.js';
import { PAGE_SIZES, type ListProducts } from '../../application/ListProducts.js';
import type { UpdateProduct } from '../../application/UpdateProduct.js';
import type { Product } from '../../domain/Product.js';

const StatusSchema = z.enum(['active', 'inactive']);

// Strict objects: unknown keys (e.g. `ownerId`, or `status` on create) are a 400, not ignored.
const CreateProductRequestSchema = z
  .strictObject({
    name: z.string().meta({ example: 'Mate gourd' }),
    description: z.string().optional().meta({ example: 'Hand-made calabash gourd' }),
    price: z.number().int().min(0).meta({ description: 'Whole ARS pesos.', example: 15000 }),
    stock: z.number().int().min(0).meta({ example: 12 }),
  })
  .meta({ id: 'CreateProductRequest' });

const UpdateProductRequestSchema = z
  .strictObject({
    name: z.string(),
    description: z.string().meta({ description: 'A blank value clears the description.' }),
    price: z.number().int().min(0).meta({ description: 'Whole ARS pesos.' }),
    stock: z.number().int().min(0),
    status: StatusSchema,
  })
  .partial()
  .meta({
    id: 'UpdateProductRequest',
    description: 'Only the fields sent are updated; at least one is required.',
  });

const ProductResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string().meta({ example: 'Mate gourd' }),
    description: z.string().optional().meta({ example: 'Hand-made calabash gourd' }),
    price: z.number().int().meta({ description: 'Whole ARS pesos.', example: 15000 }),
    stock: z.number().int().meta({ example: 12 }),
    status: StatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'ProductResponse' });

const PaginationSchema = z
  .object({
    page: z.number().int().meta({ example: 1 }),
    pageSize: z.union([z.literal(5), z.literal(10), z.literal(20)]).meta({ example: 10 }),
    total: z.number().int().meta({ example: 42 }),
    totalPages: z.number().int().meta({ example: 5 }),
  })
  .meta({ id: 'Pagination' });

const ProductListResponseSchema = z
  .object({ items: z.array(ProductResponseSchema), pagination: PaginationSchema })
  .meta({ id: 'ProductListResponse' });

// Query values arrive as strings: only plain digits are accepted, then range-checked.
const digits = z.string().regex(/^\d+$/, 'must be a whole number').transform(Number);

const ListProductsQuerySchema = z.object({
  page: digits
    .pipe(z.number().int().min(1))
    .default(1)
    .meta({ description: 'Starts at 1.', example: 1 }),
  pageSize: digits
    .pipe(z.number().refine((n) => (PAGE_SIZES.allowed as readonly number[]).includes(n)))
    .default(PAGE_SIZES.default)
    .meta({ description: 'One of 5, 10 or 20.', example: 10 }),
  status: StatusSchema.default('active').meta({
    description: 'Filter by status. Defaults to `active`.',
  }),
});

// A malformed id is a 400 validation problem (the id is never looked up).
const ProductParamsSchema = z.object({ id: z.uuid() });

const JSON_TYPE = 'application/json';
const SECURITY = [{ bearerAuth: [] }];
const UNAUTHORIZED = problemResponse(
  'Missing, invalid or expired access token (`WWW-Authenticate: Bearer`).',
);
const NOT_FOUND = problemResponse(
  'The product does not exist or belongs to another account (never 403).',
);

openApiRegistry.registerPath({
  method: 'post',
  path: '/products',
  tags: ['Products'],
  summary: 'Create a product',
  description: 'The product is created `active` and owned by the authenticated account.',
  security: SECURITY,
  request: {
    body: { required: true, content: { [JSON_TYPE]: { schema: CreateProductRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Product created.',
      headers: { Location: { description: 'URL of the new product.', schema: { type: 'string' } } },
      content: { [JSON_TYPE]: { schema: ProductResponseSchema } },
    },
    400: problemResponse('The request body is invalid (unknown keys such as `ownerId` included).'),
    401: UNAUTHORIZED,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/products',
  tags: ['Products'],
  summary: "List the authenticated account's products",
  description: 'Newest first, one page at a time. Only `active` products unless filtered.',
  security: SECURITY,
  request: { query: ListProductsQuerySchema },
  responses: {
    200: {
      description: 'A page of products.',
      content: { [JSON_TYPE]: { schema: ProductListResponseSchema } },
    },
    400: problemResponse('Invalid `page`, `pageSize` or `status`.'),
    401: UNAUTHORIZED,
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/products/{id}',
  tags: ['Products'],
  summary: 'Get a product',
  security: SECURITY,
  request: { params: ProductParamsSchema },
  responses: {
    200: { description: 'The product.', content: { [JSON_TYPE]: { schema: ProductResponseSchema } } },
    400: problemResponse('The id is not a UUID.'),
    401: UNAUTHORIZED,
    404: NOT_FOUND,
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/products/{id}',
  tags: ['Products'],
  summary: 'Partially update a product',
  security: SECURITY,
  request: {
    params: ProductParamsSchema,
    body: { required: true, content: { [JSON_TYPE]: { schema: UpdateProductRequestSchema } } },
  },
  responses: {
    200: {
      description: 'The updated product.',
      content: { [JSON_TYPE]: { schema: ProductResponseSchema } },
    },
    400: problemResponse('Invalid id or body (empty body and unknown keys included).'),
    401: UNAUTHORIZED,
    404: NOT_FOUND,
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/products/{id}',
  tags: ['Products'],
  summary: 'Soft delete a product',
  description: 'Sets `status = inactive`; the row is kept. Idempotent.',
  security: SECURITY,
  request: { params: ProductParamsSchema },
  responses: {
    204: { description: 'The product is inactive.' },
    400: problemResponse('The id is not a UUID.'),
    401: UNAUTHORIZED,
    404: NOT_FOUND,
  },
});

/** Public shape of a product: no `ownerId`, ISO timestamps, `description` only when set. */
function toResponse(product: Product): z.output<typeof ProductResponseSchema> {
  return {
    id: product.id,
    name: product.name,
    ...(product.description !== undefined && { description: product.description }),
    price: product.price,
    stock: product.stock,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export interface ProductsRouterDependencies {
  tokens: AccessTokenService;
  createProduct: CreateProduct;
  getProduct: GetProduct;
  updateProduct: UpdateProduct;
  deactivateProduct: DeactivateProduct;
  listProducts: ListProducts;
}

export function createProductsRouter({
  tokens,
  createProduct,
  getProduct,
  updateProduct,
  deactivateProduct,
  listProducts,
}: ProductsRouterDependencies): Router {
  const router = Router();
  // Every product route is authenticated; `ownerId` comes only from the verified token.
  router.use('/products', requireAuth(tokens));

  const create = { body: CreateProductRequestSchema };
  router.post('/products', validate(create), async (_req, res) => {
    const { body } = validated(res, create);
    const product = await createProduct.execute({ ...body, ownerId: authenticatedOwnerId(res) });
    res.status(201).location(`/products/${product.id}`).json(toResponse(product));
  });

  const list = { query: ListProductsQuerySchema };
  router.get('/products', validate(list), async (_req, res) => {
    const { query } = validated(res, list);
    const { items, ...pagination } = await listProducts.execute({
      ...query,
      ownerId: authenticatedOwnerId(res),
    });
    res.json({ items: items.map(toResponse), pagination });
  });

  const detail = { params: ProductParamsSchema };
  router.get('/products/:id', validate(detail), async (_req, res) => {
    const { params } = validated(res, detail);
    const product = await getProduct.execute({ ownerId: authenticatedOwnerId(res), id: params.id });
    res.json(toResponse(product));
  });

  const update = { params: ProductParamsSchema, body: UpdateProductRequestSchema };
  router.patch('/products/:id', validate(update), async (_req, res) => {
    const { params, body } = validated(res, update);
    const product = await updateProduct.execute({
      ownerId: authenticatedOwnerId(res),
      id: params.id,
      changes: body,
    });
    res.json(toResponse(product));
  });

  const remove = { params: ProductParamsSchema };
  router.delete('/products/:id', validate(remove), async (_req, res) => {
    const { params } = validated(res, remove);
    await deactivateProduct.execute({ ownerId: authenticatedOwnerId(res), id: params.id });
    res.status(204).end();
  });

  return router;
}
