import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../shared/domain/errors.js';
import { Product, type ProductStatus } from './Product.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validProps = {
  ownerId: 'owner-123',
  name: 'Handmade mug',
  description: 'Ceramic mug, 350 ml',
  price: 12500,
  stock: 10,
};

function expectValidationError(fn: () => unknown, field: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ValidationError);
  expect((caught as ValidationError).field).toBe(field);
}

describe('Product.create', () => {
  it('creates an active product with a generated UUID from valid data', () => {
    const product = Product.create(validProps);

    expect(product.id).toMatch(UUID_PATTERN);
    expect(product.status).toBe('active');
    expect(product.ownerId).toBe(validProps.ownerId);
    expect(product.name).toBe(validProps.name);
    expect(product.description).toBe(validProps.description);
    expect(product.price).toBe(validProps.price);
    expect(product.stock).toBe(validProps.stock);
  });

  it('sets createdAt and updatedAt to the same creation date', () => {
    const product = Product.create(validProps);

    expect(product.createdAt).toBeInstanceOf(Date);
    expect(product.updatedAt).toBeInstanceOf(Date);
    expect(product.updatedAt.getTime()).toBe(product.createdAt.getTime());
  });

  it('generates a different id for each product', () => {
    const first = Product.create(validProps);
    const second = Product.create(validProps);

    expect(first.id).not.toBe(second.id);
  });

  it('accepts a product without a description', () => {
    const { description: _omitted, ...withoutDescription } = validProps;

    const product = Product.create(withoutDescription);

    expect(product.description).toBeUndefined();
  });

  it.each(['', '   '])('treats a blank description (%j) as absent', (description) => {
    const product = Product.create({ ...validProps, description });

    expect(product.description).toBeUndefined();
  });

  it('trims the name and description', () => {
    const product = Product.create({
      ...validProps,
      name: '  Handmade mug  ',
      description: '  Ceramic mug  ',
    });

    expect(product.name).toBe('Handmade mug');
    expect(product.description).toBe('Ceramic mug');
  });

  it.each(['', '   '])('rejects a blank name (%j)', (name) => {
    expectValidationError(() => Product.create({ ...validProps, name }), 'name');
  });

  it.each(['', '   '])('rejects a blank ownerId (%j)', (ownerId) => {
    expectValidationError(() => Product.create({ ...validProps, ownerId }), 'ownerId');
  });

  it.each([
    ['negative', -1],
    ['non-integer', 12.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects a %s price', (_label, price) => {
    expectValidationError(() => Product.create({ ...validProps, price }), 'price');
  });

  it('accepts a price of 0', () => {
    expect(Product.create({ ...validProps, price: 0 }).price).toBe(0);
  });

  it.each([
    ['negative', -1],
    ['non-integer', 1.5],
    ['NaN', Number.NaN],
  ])('rejects a %s stock', (_label, stock) => {
    expectValidationError(() => Product.create({ ...validProps, stock }), 'stock');
  });

  it('accepts a stock of 0', () => {
    expect(Product.create({ ...validProps, stock: 0 }).stock).toBe(0);
  });
});

describe('Product.restore', () => {
  const persistedState = {
    id: '0b6f2a52-3c1e-4d7a-9f4e-6a1d2c3b4e5f',
    ownerId: '6c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    name: 'Handmade mug',
    description: 'Ceramic mug, 350 ml',
    price: 12500,
    stock: 10,
    status: 'inactive' as const,
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
    updatedAt: new Date('2026-02-20T08:30:00.000Z'),
  };

  it('rebuilds a product keeping its persisted id, status and timestamps', () => {
    const product = Product.restore(persistedState);

    expect(product).toBeInstanceOf(Product);
    expect(product.id).toBe(persistedState.id);
    expect(product.ownerId).toBe(persistedState.ownerId);
    expect(product.name).toBe(persistedState.name);
    expect(product.description).toBe(persistedState.description);
    expect(product.price).toBe(persistedState.price);
    expect(product.stock).toBe(persistedState.stock);
    expect(product.status).toBe('inactive');
    expect(product.createdAt.toISOString()).toBe('2026-01-10T12:00:00.000Z');
    expect(product.updatedAt.toISOString()).toBe('2026-02-20T08:30:00.000Z');
  });

  it('keeps the description absent when the persisted state has none', () => {
    const { description: _omitted, ...withoutDescription } = persistedState;

    const product = Product.restore(withoutDescription);

    expect(product.description).toBeUndefined();
  });
});

describe('Product.update', () => {
  const createdAt = new Date('2026-01-01T10:00:00.000Z');
  const later = new Date('2026-02-01T10:00:00.000Z');

  function persistedProduct(): Product {
    return Product.restore({
      id: '11111111-1111-4111-8111-111111111111',
      ownerId: 'owner-123',
      name: 'Handmade mug',
      description: 'Ceramic mug, 350 ml',
      price: 12500,
      stock: 10,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    });
  }

  it('returns a new product with only the provided fields changed', () => {
    const original = persistedProduct();

    const updated = original.update({ price: 15000 }, later);

    expect(updated).not.toBe(original);
    expect(updated.price).toBe(15000);
    expect(updated.name).toBe(original.name);
    expect(updated.description).toBe(original.description);
    expect(updated.stock).toBe(original.stock);
    expect(updated.status).toBe(original.status);
    expect(original.price).toBe(12500);
  });

  it('keeps id, ownerId and createdAt and sets updatedAt to now', () => {
    const original = persistedProduct();

    const updated = original.update({ name: 'Large mug' }, later);

    expect(updated.id).toBe(original.id);
    expect(updated.ownerId).toBe(original.ownerId);
    expect(updated.createdAt.getTime()).toBe(createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBe(later.getTime());
  });

  it('updates every field at once, trimming text', () => {
    const updated = persistedProduct().update(
      { name: '  Large mug  ', description: '  500 ml  ', price: 0, stock: 0, status: 'inactive' },
      later,
    );

    expect(updated.name).toBe('Large mug');
    expect(updated.description).toBe('500 ml');
    expect(updated.price).toBe(0);
    expect(updated.stock).toBe(0);
    expect(updated.status).toBe('inactive');
  });

  it('clears the description when an empty or blank one is provided', () => {
    expect(persistedProduct().update({ description: '' }, later).description).toBeUndefined();
    expect(persistedProduct().update({ description: '   ' }, later).description).toBeUndefined();
  });

  it('rejects an empty change set', () => {
    expectValidationError(() => persistedProduct().update({}, later), 'body');
  });

  it('rejects a blank name', () => {
    expectValidationError(() => persistedProduct().update({ name: '   ' }, later), 'name');
  });

  it.each([-1, 1.5, Number.NaN])('rejects an invalid price %s', (price) => {
    expectValidationError(() => persistedProduct().update({ price }, later), 'price');
  });

  it.each([-1, 2.5, Number.POSITIVE_INFINITY])('rejects an invalid stock %s', (stock) => {
    expectValidationError(() => persistedProduct().update({ stock }, later), 'stock');
  });

  it('rejects an unknown status', () => {
    expectValidationError(
      () => persistedProduct().update({ status: 'archived' as ProductStatus }, later),
      'status',
    );
  });

  it('defaults updatedAt to the current time', () => {
    const before = Date.now();

    const updated = persistedProduct().update({ stock: 3 });

    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('Product.deactivate', () => {
  const createdAt = new Date('2026-01-01T10:00:00.000Z');
  const later = new Date('2026-02-01T10:00:00.000Z');

  function persistedProduct(status: ProductStatus): Product {
    return Product.restore({
      id: '22222222-2222-4222-8222-222222222222',
      ownerId: 'owner-123',
      name: 'Handmade mug',
      price: 12500,
      stock: 10,
      status,
      createdAt,
      updatedAt: createdAt,
    });
  }

  it('returns a new inactive product with updatedAt set to now', () => {
    const original = persistedProduct('active');

    const deactivated = original.deactivate(later);

    expect(deactivated).not.toBe(original);
    expect(deactivated.status).toBe('inactive');
    expect(deactivated.updatedAt.getTime()).toBe(later.getTime());
    expect(deactivated.id).toBe(original.id);
    expect(deactivated.createdAt.getTime()).toBe(createdAt.getTime());
    expect(original.status).toBe('active');
  });

  it('is idempotent for an already inactive product', () => {
    const deactivated = persistedProduct('inactive').deactivate(later);

    expect(deactivated.status).toBe('inactive');
    expect(deactivated.name).toBe('Handmade mug');
  });
});
