import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../shared/domain/errors.js';
import { Product } from '../domain/Product.js';
import { InMemoryProductRepository } from '../infrastructure/testing/InMemoryProductRepository.js';
import { DeactivateProduct } from './DeactivateProduct.js';

async function setup() {
  const repository = new InMemoryProductRepository();
  const product = Product.create({ ownerId: 'owner-a', name: 'Mug', price: 100, stock: 1 });
  await repository.save(product);
  return { repository, deactivateProduct: new DeactivateProduct(repository), product };
}

describe('DeactivateProduct', () => {
  it('soft deletes the product by saving it as inactive', async () => {
    const { repository, deactivateProduct, product } = await setup();

    const result = await deactivateProduct.execute({ ownerId: 'owner-a', id: product.id });

    expect(result).toBeUndefined();
    const stored = await repository.findById('owner-a', product.id);
    expect(stored?.status).toBe('inactive');
    expect(stored?.name).toBe('Mug');
  });

  it('is idempotent for an already inactive product', async () => {
    const { repository, deactivateProduct, product } = await setup();
    await deactivateProduct.execute({ ownerId: 'owner-a', id: product.id });

    await deactivateProduct.execute({ ownerId: 'owner-a', id: product.id });

    expect((await repository.findById('owner-a', product.id))?.status).toBe('inactive');
  });

  it('throws NotFoundError when the product does not exist', async () => {
    const { deactivateProduct } = await setup();

    await expect(
      deactivateProduct.execute({ ownerId: 'owner-a', id: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError and keeps the product active for another owner', async () => {
    const { repository, deactivateProduct, product } = await setup();

    await expect(
      deactivateProduct.execute({ ownerId: 'owner-b', id: product.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await repository.findById('owner-a', product.id))?.status).toBe('active');
  });
});
