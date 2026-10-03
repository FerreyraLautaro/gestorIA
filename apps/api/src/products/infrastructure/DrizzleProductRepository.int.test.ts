import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createDatabase, type Database } from '../../shared/infrastructure/db/database.js';
import { Product, type ProductState } from '../domain/Product.js';
import { DrizzleProductRepository } from './DrizzleProductRepository.js';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';

let database: Database;
let repository: DrizzleProductRepository;

beforeAll(() => {
  // Provided by vitest.global-setup.ts once the test database exists and is migrated.
  database = createDatabase(inject('testDatabaseUrl'));
  repository = new DrizzleProductRepository(database.db);
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.db.execute(sql`TRUNCATE TABLE products`);
});

let sequence = 0;

/** Builds a persisted-like state with a deterministic, strictly increasing createdAt. */
function productState(overrides: Partial<ProductState> = {}): ProductState {
  sequence += 1;
  const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence));
  return {
    id: randomUUID(),
    ownerId: OWNER_A,
    name: `Product ${sequence}`,
    description: `Description ${sequence}`,
    price: 1000 + sequence,
    stock: sequence,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('DrizzleProductRepository', () => {
  describe('save + findById', () => {
    it('round-trips every field', async () => {
      const state = productState({
        status: 'inactive',
        createdAt: new Date('2026-03-01T10:00:00.123Z'),
        updatedAt: new Date('2026-03-02T11:30:00.456Z'),
      });

      await repository.save(Product.restore(state));
      const found = await repository.findById(OWNER_A, state.id);

      expect(found).toBeInstanceOf(Product);
      expect({ ...found }).toEqual(state);
    });

    it('round-trips a product created through the domain factory', async () => {
      const product = Product.create({ ownerId: OWNER_A, name: 'Mug', price: 0, stock: 0 });

      await repository.save(product);
      const found = await repository.findById(OWNER_A, product.id);

      expect({ ...found }).toEqual({ ...product });
    });

    it('keeps an absent description absent', async () => {
      const { description: _omitted, ...withoutDescription } = productState();

      await repository.save(Product.restore(withoutDescription));
      const found = await repository.findById(OWNER_A, withoutDescription.id);

      expect(found).not.toBeNull();
      expect(found?.description).toBeUndefined();
    });

    it('returns null for an unknown id', async () => {
      expect(await repository.findById(OWNER_A, randomUUID())).toBeNull();
    });

    it('returns null when the product belongs to another owner', async () => {
      const state = productState({ ownerId: OWNER_A });
      await repository.save(Product.restore(state));

      expect(await repository.findById(OWNER_B, state.id)).toBeNull();
    });
  });

  describe('save on an existing id', () => {
    it('updates the stored row instead of inserting a new one', async () => {
      const original = productState();
      await repository.save(Product.restore(original));

      const { description: _removed, ...rest } = original;
      const updated: ProductState = {
        ...rest,
        name: 'Renamed',
        price: 99,
        stock: 0,
        status: 'inactive',
        updatedAt: new Date('2026-05-05T05:05:05.000Z'),
      };
      await repository.save(Product.restore(updated));

      const found = await repository.findById(OWNER_A, original.id);
      expect({ ...found }).toEqual(updated);
      const { total } = await repository.list(OWNER_A, { page: 1, pageSize: 20 });
      expect(total).toBe(1);
    });

    it('never overwrites a product that belongs to another owner', async () => {
      const original = productState({ ownerId: OWNER_A });
      await repository.save(Product.restore(original));

      const hijack = Product.restore({ ...original, ownerId: OWNER_B, name: 'Hijacked' });

      await expect(repository.save(hijack)).rejects.toThrow(/another owner/);
      expect({ ...(await repository.findById(OWNER_A, original.id)) }).toEqual(original);
      expect(await repository.findById(OWNER_B, original.id)).toBeNull();
    });

    it('keeps the original createdAt when updating', async () => {
      const original = productState();
      await repository.save(Product.restore(original));

      await repository.save(
        Product.restore({ ...original, createdAt: new Date('2030-01-01T00:00:00.000Z') }),
      );

      const found = await repository.findById(OWNER_A, original.id);
      expect(found?.createdAt).toEqual(original.createdAt);
    });
  });

  describe('list', () => {
    it('returns the requested page ordered by createdAt desc with the total count', async () => {
      const states = Array.from({ length: 7 }, () => productState());
      for (const state of states) {
        await repository.save(Product.restore(state));
      }
      const newestFirst = [...states].reverse().map((state) => state.id);

      const first = await repository.list(OWNER_A, { page: 1, pageSize: 5 });
      const second = await repository.list(OWNER_A, { page: 2, pageSize: 5 });
      const beyond = await repository.list(OWNER_A, { page: 3, pageSize: 5 });

      expect(first.total).toBe(7);
      expect(first.items[0]).toBeInstanceOf(Product);
      expect(first.items.map((product) => product.id)).toEqual(newestFirst.slice(0, 5));
      expect(second.total).toBe(7);
      expect(second.items.map((product) => product.id)).toEqual(newestFirst.slice(5));
      expect(beyond).toEqual({ items: [], total: 7 });
    });

    it('breaks createdAt ties by id, descending', async () => {
      const createdAt = new Date('2026-04-04T04:04:04.000Z');
      const ids = [
        'aaaaaaaa-0000-4000-8000-000000000000',
        'cccccccc-0000-4000-8000-000000000000',
        'bbbbbbbb-0000-4000-8000-000000000000',
      ];
      for (const id of ids) {
        await repository.save(Product.restore(productState({ id, createdAt })));
      }

      const { items } = await repository.list(OWNER_A, { page: 1, pageSize: 10 });

      expect(items.map((product) => product.id)).toEqual([
        'cccccccc-0000-4000-8000-000000000000',
        'bbbbbbbb-0000-4000-8000-000000000000',
        'aaaaaaaa-0000-4000-8000-000000000000',
      ]);
    });

    it('filters by status when provided', async () => {
      const active = productState({ status: 'active' });
      const inactive = productState({ status: 'inactive' });
      await repository.save(Product.restore(active));
      await repository.save(Product.restore(inactive));

      const onlyInactive = await repository.list(OWNER_A, {
        page: 1,
        pageSize: 10,
        status: 'inactive',
      });
      const all = await repository.list(OWNER_A, { page: 1, pageSize: 10 });

      expect(onlyInactive.total).toBe(1);
      expect(onlyInactive.items.map((product) => product.id)).toEqual([inactive.id]);
      expect(all.total).toBe(2);
    });

    it('only returns products of the requested owner', async () => {
      const mine = productState({ ownerId: OWNER_A });
      const theirs = productState({ ownerId: OWNER_B });
      await repository.save(Product.restore(mine));
      await repository.save(Product.restore(theirs));

      const result = await repository.list(OWNER_B, { page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.items.map((product) => product.id)).toEqual([theirs.id]);
    });
  });
});
