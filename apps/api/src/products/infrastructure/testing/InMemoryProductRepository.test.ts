import { describe, expect, it } from 'vitest';
import { Product, type ProductStatus } from '../../domain/Product.js';
import { InMemoryProductRepository } from './InMemoryProductRepository.js';

const OWNER = 'owner-a';
const OTHER_OWNER = 'owner-b';

function productAt(
  id: string,
  createdAt: string,
  options: { ownerId?: string; status?: ProductStatus } = {},
): Product {
  const date = new Date(createdAt);
  return Product.restore({
    id,
    ownerId: options.ownerId ?? OWNER,
    name: `Product ${id}`,
    price: 100,
    stock: 1,
    status: options.status ?? 'active',
    createdAt: date,
    updatedAt: date,
  });
}

describe('InMemoryProductRepository', () => {
  it('finds a saved product only for its owner', async () => {
    const repository = new InMemoryProductRepository();
    const product = productAt('p1', '2026-01-01T00:00:00Z');
    await repository.save(product);

    expect((await repository.findById(OWNER, 'p1'))?.id).toBe('p1');
    expect(await repository.findById(OTHER_OWNER, 'p1')).toBeNull();
    expect(await repository.findById(OWNER, 'missing')).toBeNull();
  });

  it('updates a product but keeps its original createdAt', async () => {
    const repository = new InMemoryProductRepository();
    const original = productAt('p1', '2026-01-01T00:00:00Z');
    await repository.save(original);
    const changed = Product.restore({
      ...original,
      name: 'Renamed',
      createdAt: new Date('2030-01-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    });

    await repository.save(changed);

    const stored = await repository.findById(OWNER, 'p1');
    expect(stored?.name).toBe('Renamed');
    expect(stored?.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(stored?.updatedAt.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it("refuses to overwrite another owner's product", async () => {
    const repository = new InMemoryProductRepository();
    await repository.save(productAt('p1', '2026-01-01T00:00:00Z'));

    await expect(
      repository.save(productAt('p1', '2026-01-01T00:00:00Z', { ownerId: OTHER_OWNER })),
    ).rejects.toThrow(/another owner/);
    expect((await repository.findById(OWNER, 'p1'))?.ownerId).toBe(OWNER);
  });

  it('lists owner products by createdAt desc then id desc, paginated', async () => {
    const repository = new InMemoryProductRepository();
    await repository.save(productAt('a', '2026-01-01T00:00:00Z'));
    await repository.save(productAt('b', '2026-01-02T00:00:00Z'));
    await repository.save(productAt('c', '2026-01-02T00:00:00Z'));
    await repository.save(productAt('x', '2026-01-03T00:00:00Z', { ownerId: OTHER_OWNER }));

    const first = await repository.list(OWNER, { page: 1, pageSize: 2 });
    const second = await repository.list(OWNER, { page: 2, pageSize: 2 });

    expect(first.items.map((p) => p.id)).toEqual(['c', 'b']);
    expect(second.items.map((p) => p.id)).toEqual(['a']);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
  });

  it('filters by status when requested', async () => {
    const repository = new InMemoryProductRepository();
    await repository.save(productAt('a', '2026-01-01T00:00:00Z'));
    await repository.save(productAt('b', '2026-01-02T00:00:00Z', { status: 'inactive' }));

    const inactive = await repository.list(OWNER, { page: 1, pageSize: 10, status: 'inactive' });
    const all = await repository.list(OWNER, { page: 1, pageSize: 10 });

    expect(inactive.items.map((p) => p.id)).toEqual(['b']);
    expect(inactive.total).toBe(1);
    expect(all.total).toBe(2);
  });
});
