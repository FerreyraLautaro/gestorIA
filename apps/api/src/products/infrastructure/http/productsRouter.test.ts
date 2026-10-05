import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { JwtAccessTokenService } from '../../../accounts/infrastructure/JwtAccessTokenService.js';
import { createApp } from '../../../app.js';
import { CreateProduct } from '../../application/CreateProduct.js';
import { DeactivateProduct } from '../../application/DeactivateProduct.js';
import { GetProduct } from '../../application/GetProduct.js';
import { ListProducts } from '../../application/ListProducts.js';
import { UpdateProduct } from '../../application/UpdateProduct.js';
import { InMemoryProductRepository } from '../testing/InMemoryProductRepository.js';
import { createProductsRouter } from './productsRouter.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const ACCOUNT_A = randomUUID();
const ACCOUNT_B = randomUUID();
const validBody = { name: 'Mate', description: 'Gourd', price: 1500, stock: 3 };

function buildApp() {
  const repository = new InMemoryProductRepository();
  const tokens = new JwtAccessTokenService(SECRET);
  const app = createApp({
    routers: [
      createProductsRouter({
        tokens,
        createProduct: new CreateProduct(repository),
        getProduct: new GetProduct(repository),
        updateProduct: new UpdateProduct(repository),
        deactivateProduct: new DeactivateProduct(repository),
        listProducts: new ListProducts(repository),
      }),
    ],
  });
  return { app, tokens };
}

type App = ReturnType<typeof buildApp>['app'];
type Method = 'post' | 'get' | 'patch' | 'delete';

async function bearer(tokens: JwtAccessTokenService, accountId: string): Promise<string> {
  return `Bearer ${(await tokens.issue(accountId)).token}`;
}

function createAs(app: App, auth: string, body: object = validBody) {
  return request(app).post('/products').set('Authorization', auth).send(body);
}

describe('authentication on every products route', () => {
  const routes: Array<[Method, string]> = [
    ['post', '/products'],
    ['get', '/products'],
    ['get', `/products/${randomUUID()}`],
    ['patch', `/products/${randomUUID()}`],
    ['delete', `/products/${randomUUID()}`],
  ];

  it.each(routes)('%s %s answers 401 with a Bearer challenge without a token', async (method, path) => {
    const { app } = buildApp();

    const response = await request(app)[method](path).expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it.each(routes)('%s %s answers 401 for a bad token', async (method, path) => {
    const { app } = buildApp();

    const response = await request(app)[method](path)
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it.each(routes)('%s %s answers 401 for an expired token', async (method, path) => {
    const { app } = buildApp();
    const past = new JwtAccessTokenService(SECRET, () => new Date('2020-01-01T00:00:00Z'));

    const response = await request(app)[method](path)
      .set('Authorization', await bearer(past, ACCOUNT_A))
      .expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
  });
});

describe('POST /products', () => {
  it('creates an active product owned by the token account', async () => {
    const { app, tokens } = buildApp();

    const response = await createAs(app, await bearer(tokens, ACCOUNT_A));

    expect(response.status).toBe(201);
    expect(response.headers['location']).toBe(`/products/${response.body.id}`);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Mate',
      description: 'Gourd',
      price: 1500,
      stock: 3,
      status: 'active',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    });
    expect(response.body).not.toHaveProperty('ownerId');
  });

  it('omits description when absent', async () => {
    const { app, tokens } = buildApp();

    const response = await createAs(app, await bearer(tokens, ACCOUNT_A), {
      name: 'Bombilla',
      price: 0,
      stock: 0,
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('description');
  });

  it.each([
    ['ownerId', { ...validBody, ownerId: ACCOUNT_B }],
    ['status', { ...validBody, status: 'inactive' }],
    ['unknown key', { ...validBody, color: 'red' }],
    ['missing name', { price: 1, stock: 1 }],
    ['fractional price', { ...validBody, price: 10.5 }],
    ['negative stock', { ...validBody, stock: -1 }],
    ['string price', { ...validBody, price: '10' }],
  ])('answers 400 validation problem for %s', async (_name, body) => {
    const { app, tokens } = buildApp();

    const response = await createAs(app, await bearer(tokens, ACCOUNT_A), body);

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('never lets a body ownerId create a product for another account', async () => {
    const { app, tokens } = buildApp();
    await createAs(app, await bearer(tokens, ACCOUNT_A), { ...validBody, ownerId: ACCOUNT_B });

    const listB = await request(app)
      .get('/products')
      .set('Authorization', await bearer(tokens, ACCOUNT_B))
      .expect(200);

    expect(listB.body.items).toEqual([]);
  });
});

describe('GET /products/:id', () => {
  it('returns the product', async () => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    const created = await createAs(app, auth);

    const response = await request(app)
      .get(`/products/${created.body.id}`)
      .set('Authorization', auth)
      .expect(200);

    expect(response.body).toEqual(created.body);
  });

  it('answers 404 problem for an unknown id', async () => {
    const { app, tokens } = buildApp();

    const response = await request(app)
      .get(`/products/${randomUUID()}`)
      .set('Authorization', await bearer(tokens, ACCOUNT_A))
      .expect(404);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('answers 400 validation problem for an id that is not a UUID', async () => {
    const { app, tokens } = buildApp();

    const response = await request(app)
      .get('/products/not-a-uuid')
      .set('Authorization', await bearer(tokens, ACCOUNT_A))
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /products', () => {
  async function seed(app: App, auth: string, count: number) {
    for (let i = 1; i <= count; i += 1) {
      await createAs(app, auth, { ...validBody, name: `Product ${i}` });
    }
  }

  it('returns items with pagination, defaulting to page 1 and size 10', async () => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    await seed(app, auth, 12);

    const response = await request(app).get('/products').set('Authorization', auth).expect(200);

    expect(response.body.items).toHaveLength(10);
    expect(response.body.items[0]).not.toHaveProperty('ownerId');
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 10, total: 12, totalPages: 2 });
  });

  it('honours page and pageSize query strings', async () => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    await seed(app, auth, 7);

    const response = await request(app)
      .get('/products?page=2&pageSize=5')
      .set('Authorization', auth)
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.pagination).toEqual({ page: 2, pageSize: 5, total: 7, totalPages: 2 });
  });

  it.each([
    'pageSize=7',
    'pageSize=abc',
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=',
    'page=1&page=2',
    'status=deleted',
  ])('answers 400 for query %s', async (query) => {
    const { app, tokens } = buildApp();

    const response = await request(app)
      .get(`/products?${query}`)
      .set('Authorization', await bearer(tokens, ACCOUNT_A))
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('lists only active products by default and filters by status', async () => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    const keep = await createAs(app, auth, { ...validBody, name: 'Keep' });
    const drop = await createAs(app, auth, { ...validBody, name: 'Drop' });
    await request(app).delete(`/products/${drop.body.id}`).set('Authorization', auth).expect(204);

    const active = await request(app).get('/products').set('Authorization', auth).expect(200);
    const inactive = await request(app)
      .get('/products?status=inactive')
      .set('Authorization', auth)
      .expect(200);

    expect(active.body.items.map((p: { id: string }) => p.id)).toEqual([keep.body.id]);
    expect(inactive.body.items.map((p: { id: string }) => p.id)).toEqual([drop.body.id]);
  });
});

describe('PATCH /products/:id', () => {
  it('updates only the fields sent, including status', async () => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    const created = await createAs(app, auth);

    const response = await request(app)
      .patch(`/products/${created.body.id}`)
      .set('Authorization', auth)
      .send({ price: 2000, status: 'inactive' })
      .expect(200);

    expect(response.body).toMatchObject({ name: 'Mate', price: 2000, stock: 3, status: 'inactive' });
    expect(response.body).not.toHaveProperty('ownerId');
  });

  it.each([
    ['empty body', {}],
    ['ownerId', { ownerId: ACCOUNT_B }],
    ['unknown key', { color: 'red' }],
    ['invalid status', { status: 'deleted' }],
    ['negative price', { price: -1 }],
  ])('answers 400 for %s', async (_name, body) => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    const created = await createAs(app, auth);

    const response = await request(app)
      .patch(`/products/${created.body.id}`)
      .set('Authorization', auth)
      .send(body)
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('answers 404 for an unknown product', async () => {
    const { app, tokens } = buildApp();

    await request(app)
      .patch(`/products/${randomUUID()}`)
      .set('Authorization', await bearer(tokens, ACCOUNT_A))
      .send({ name: 'x' })
      .expect(404);
  });
});

describe('DELETE /products/:id', () => {
  it('soft deletes with 204 and is idempotent', async () => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    const created = await createAs(app, auth);

    await request(app).delete(`/products/${created.body.id}`).set('Authorization', auth).expect(204);
    await request(app).delete(`/products/${created.body.id}`).set('Authorization', auth).expect(204);

    const found = await request(app)
      .get(`/products/${created.body.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(found.body.status).toBe('inactive');
  });

  it('answers 404 for an unknown product', async () => {
    const { app, tokens } = buildApp();

    await request(app)
      .delete(`/products/${randomUUID()}`)
      .set('Authorization', await bearer(tokens, ACCOUNT_A))
      .expect(404);
  });
});

describe('PUT /products/:id', () => {
  it('is not supported and does not mutate the product', async () => {
    const { app, tokens } = buildApp();
    const auth = await bearer(tokens, ACCOUNT_A);
    const created = await createAs(app, auth);

    const response = await request(app)
      .put(`/products/${created.body.id}`)
      .set('Authorization', auth)
      .send({ ...validBody, name: 'Replaced' });

    expect([404, 405]).toContain(response.status);
    const found = await request(app)
      .get(`/products/${created.body.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(found.body).toEqual(created.body);
  });
});

describe('owner isolation', () => {
  it("hides and protects account A's products from account B", async () => {
    const { app, tokens } = buildApp();
    const authA = await bearer(tokens, ACCOUNT_A);
    const authB = await bearer(tokens, ACCOUNT_B);
    const productA = await createAs(app, authA);
    const id = productA.body.id as string;

    const get = await request(app).get(`/products/${id}`).set('Authorization', authB);
    const patch = await request(app)
      .patch(`/products/${id}`)
      .set('Authorization', authB)
      .send({ name: 'Hijacked', status: 'inactive' });
    const del = await request(app).delete(`/products/${id}`).set('Authorization', authB);
    const list = await request(app).get('/products').set('Authorization', authB);
    const listInactive = await request(app)
      .get('/products?status=inactive')
      .set('Authorization', authB);

    // 404 (never 403) so the existence of another account's product is not revealed.
    expect([get.status, patch.status, del.status]).toEqual([404, 404, 404]);
    expect(get.body.code).toBe('NOT_FOUND');
    expect(list.body.items).toEqual([]);
    expect(list.body.pagination.total).toBe(0);
    expect(listInactive.body.items).toEqual([]);

    const untouched = await request(app)
      .get(`/products/${id}`)
      .set('Authorization', authA)
      .expect(200);
    expect(untouched.body).toEqual(productA.body);
  });

  it('rejects an ownerId in the body and ignores it in the query', async () => {
    const { app, tokens } = buildApp();
    const authA = await bearer(tokens, ACCOUNT_A);
    const authB = await bearer(tokens, ACCOUNT_B);
    const productA = await createAs(app, authA);

    await request(app)
      .patch(`/products/${productA.body.id}`)
      .set('Authorization', authB)
      .send({ ownerId: ACCOUNT_B })
      .expect(400);
    const list = await request(app)
      .get(`/products?ownerId=${ACCOUNT_A}`)
      .set('Authorization', authB)
      .expect(200);

    expect(list.body.items).toEqual([]);
  });
});

describe('OpenAPI document', () => {
  it('documents the five product operations behind bearer auth', async () => {
    const { app } = buildApp();

    const { body } = await request(app).get('/openapi.json').expect(200);

    const operations: Array<[string, string, string[]]> = [
      ['/products', 'post', ['201', '400', '401']],
      ['/products', 'get', ['200', '400', '401']],
      ['/products/{id}', 'get', ['200', '400', '401', '404']],
      ['/products/{id}', 'patch', ['200', '400', '401', '404']],
      ['/products/{id}', 'delete', ['204', '400', '401', '404']],
    ];
    for (const [path, method, statuses] of operations) {
      const operation = body.paths[path][method];
      expect(operation.security, `${method} ${path}`).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(operation.responses), `${method} ${path}`).toEqual(
        expect.arrayContaining(statuses),
      );
    }
    expect(body.paths['/products'].get.parameters.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(['page', 'pageSize', 'status']),
    );
    expect(body.components.schemas.CreateProductRequest.properties).not.toHaveProperty('status');
    expect(body.components.schemas.CreateProductRequest.additionalProperties).toBe(false);
    expect(body.components.schemas.ProductResponse.properties).not.toHaveProperty('ownerId');
    expect(body.components.schemas.ProductListResponse.properties.pagination).toBeDefined();
  });
});
