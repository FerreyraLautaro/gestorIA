import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../shared/domain/errors.js';
import { InMemoryProductRepository } from '../infrastructure/testing/InMemoryProductRepository.js';
import { CreateProduct } from './CreateProduct.js';

describe('CreateProduct', () => {
  it('creates an active product for the owner and saves it', async () => {
    const repository = new InMemoryProductRepository();
    const createProduct = new CreateProduct(repository);

    const product = await createProduct.execute({
      ownerId: 'owner-a',
      name: ' Handmade mug ',
      description: 'Ceramic',
      price: 12500,
      stock: 3,
    });

    expect(product.name).toBe('Handmade mug');
    expect(product.status).toBe('active');
    expect(product.ownerId).toBe('owner-a');
    expect(await repository.findById('owner-a', product.id)).toEqual(product);
  });

  it('saves nothing when the input is invalid', async () => {
    const repository = new InMemoryProductRepository();
    const createProduct = new CreateProduct(repository);

    await expect(
      createProduct.execute({ ownerId: 'owner-a', name: 'Mug', price: -1, stock: 3 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await repository.list('owner-a', { page: 1, pageSize: 10 })).total).toBe(0);
  });
});
