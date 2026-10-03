import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../shared/domain/errors.js';
import { Product } from '../domain/Product.js';
import { InMemoryProductRepository } from '../infrastructure/testing/InMemoryProductRepository.js';
import { UpdateProduct } from './UpdateProduct.js';

async function setup() {
  const repository = new InMemoryProductRepository();
  const product = Product.create({
    ownerId: 'owner-a',
    name: 'Mug',
    description: 'Ceramic',
    price: 100,
    stock: 1,
  });
  await repository.save(product);
  return { repository, updateProduct: new UpdateProduct(repository), product };
}

describe('UpdateProduct', () => {
  it('applies the changes and saves the updated product', async () => {
    const { repository, updateProduct, product } = await setup();

    const updated = await updateProduct.execute({
      ownerId: 'owner-a',
      id: product.id,
      changes: { price: 250, description: '' },
    });

    expect(updated.price).toBe(250);
    expect(updated.description).toBeUndefined();
    expect(updated.name).toBe('Mug');
    expect(await repository.findById('owner-a', product.id)).toEqual(updated);
  });

  it('throws NotFoundError when the product does not exist', async () => {
    const { updateProduct } = await setup();

    await expect(
      updateProduct.execute({ ownerId: 'owner-a', id: 'missing', changes: { price: 1 } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError and changes nothing for another owner', async () => {
    const { repository, updateProduct, product } = await setup();

    await expect(
      updateProduct.execute({ ownerId: 'owner-b', id: product.id, changes: { price: 1 } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await repository.findById('owner-a', product.id))?.price).toBe(100);
  });

  it('propagates validation errors without saving', async () => {
    const { repository, updateProduct, product } = await setup();

    await expect(
      updateProduct.execute({ ownerId: 'owner-a', id: product.id, changes: { stock: -5 } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await repository.findById('owner-a', product.id))?.stock).toBe(1);
  });
});
