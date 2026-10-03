import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../shared/domain/errors.js';
import { Product } from '../domain/Product.js';
import { InMemoryProductRepository } from '../infrastructure/testing/InMemoryProductRepository.js';
import { GetProduct } from './GetProduct.js';

async function setup() {
  const repository = new InMemoryProductRepository();
  const product = Product.create({ ownerId: 'owner-a', name: 'Mug', price: 100, stock: 1 });
  await repository.save(product);
  return { getProduct: new GetProduct(repository), product };
}

describe('GetProduct', () => {
  it("returns the owner's product", async () => {
    const { getProduct, product } = await setup();

    const found = await getProduct.execute({ ownerId: 'owner-a', id: product.id });

    expect(found).toEqual(product);
  });

  it('throws NotFoundError with the resource and id when the product does not exist', async () => {
    const { getProduct } = await setup();

    const error: unknown = await getProduct
      .execute({ ownerId: 'owner-a', id: 'missing' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ resource: 'product', id: 'missing' });
  });

  it('throws NotFoundError when the product belongs to another owner', async () => {
    const { getProduct, product } = await setup();

    await expect(
      getProduct.execute({ ownerId: 'owner-b', id: product.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
