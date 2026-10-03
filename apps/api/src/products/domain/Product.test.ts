import { describe, expect, it } from 'vitest';
import { Product } from './Product.js';

const validProps = {
  ownerId: 'owner-123',
  name: 'Handmade mug',
  description: 'Ceramic mug, 350 ml',
  price: 12.5,
  stock: 10,
};

describe('Product.create', () => {
  it('creates an active product with a generated id from valid data', () => {
    const product = Product.create(validProps);

    expect(product.id).toEqual(expect.any(String));
    expect(product.id).not.toHaveLength(0);
    expect(product.status).toBe('active');
    expect(product.ownerId).toBe(validProps.ownerId);
    expect(product.name).toBe(validProps.name);
    expect(product.description).toBe(validProps.description);
    expect(product.price).toBe(validProps.price);
    expect(product.stock).toBe(validProps.stock);
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

  it.each(['', '   '])('rejects a blank name (%j)', (name) => {
    expect(() => Product.create({ ...validProps, name })).toThrow();
  });

  it('rejects a negative price', () => {
    expect(() => Product.create({ ...validProps, price: -0.01 })).toThrow();
  });

  it('rejects a negative stock', () => {
    expect(() => Product.create({ ...validProps, stock: -1 })).toThrow();
  });

  it('rejects a non-integer stock', () => {
    expect(() => Product.create({ ...validProps, stock: 1.5 })).toThrow();
  });

  it.each(['', '   '])('rejects a blank ownerId (%j)', (ownerId) => {
    expect(() => Product.create({ ...validProps, ownerId })).toThrow();
  });
});
