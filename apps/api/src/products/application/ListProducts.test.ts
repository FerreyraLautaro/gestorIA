import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../shared/domain/errors.js';
import { Product, type ProductStatus } from '../domain/Product.js';
import { InMemoryProductRepository } from '../infrastructure/testing/InMemoryProductRepository.js';
import { ListProducts, PAGE_SIZES } from './ListProducts.js';

async function seed(
  repository: InMemoryProductRepository,
  count: number,
  options: { status?: ProductStatus; ownerId?: string } = {},
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const created = Product.create({
      ownerId: options.ownerId ?? 'owner-a',
      name: `Product ${i}`,
      price: 100,
      stock: 1,
    });
    await repository.save(options.status === 'inactive' ? created.deactivate() : created);
  }
}

async function expectValidationField(promise: Promise<unknown>, field: string): Promise<void> {
  const error: unknown = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ValidationError);
  expect((error as ValidationError).field).toBe(field);
}

describe('ListProducts', () => {
  it('exposes the allowed page sizes and the default in one constant', () => {
    expect(PAGE_SIZES.allowed).toEqual([5, 10, 20]);
    expect(PAGE_SIZES.default).toBe(10);
  });

  it('defaults to page 1, page size 10 and active products only', async () => {
    const repository = new InMemoryProductRepository();
    await seed(repository, 12);
    await seed(repository, 1, { status: 'inactive' });

    const result = await new ListProducts(repository).execute({ ownerId: 'owner-a' });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(10);
    expect(result.items.every((product) => product.status === 'active')).toBe(true);
  });

  it('returns the requested page', async () => {
    const repository = new InMemoryProductRepository();
    await seed(repository, 12);

    const result = await new ListProducts(repository).execute({
      ownerId: 'owner-a',
      page: 3,
      pageSize: 5,
    });

    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(5);
    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(3);
  });

  it('lists inactive products when explicitly requested', async () => {
    const repository = new InMemoryProductRepository();
    await seed(repository, 2, { status: 'inactive' });
    const listProducts = new ListProducts(repository);

    const inactive = await listProducts.execute({ ownerId: 'owner-a', status: 'inactive' });
    const active = await listProducts.execute({ ownerId: 'owner-a' });

    expect(inactive.total).toBe(2);
    expect(inactive.items.every((product) => product.status === 'inactive')).toBe(true);
    expect(active.total).toBe(0);
  });

  it('returns zero total pages when there are no products', async () => {
    const result = await new ListProducts(new InMemoryProductRepository()).execute({
      ownerId: 'owner-a',
    });

    expect(result).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  });

  it("never lists another owner's products", async () => {
    const repository = new InMemoryProductRepository();
    await seed(repository, 3, { ownerId: 'owner-b' });

    const result = await new ListProducts(repository).execute({ ownerId: 'owner-a' });

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects page %s', async (page) => {
    const listProducts = new ListProducts(new InMemoryProductRepository());

    await expectValidationField(listProducts.execute({ ownerId: 'owner-a', page }), 'page');
  });

  it.each([0, 1, 7, 15, 50, 10.5])('rejects pageSize %s', async (pageSize) => {
    const listProducts = new ListProducts(new InMemoryProductRepository());

    await expectValidationField(
      listProducts.execute({ ownerId: 'owner-a', pageSize }),
      'pageSize',
    );
  });

  it.each(['archived', 'ACTIVE', '', 'all'])('rejects status %j', async (status) => {
    const listProducts = new ListProducts(new InMemoryProductRepository());

    await expectValidationField(
      listProducts.execute({ ownerId: 'owner-a', status: status as ProductStatus }),
      'status',
    );
  });
});
