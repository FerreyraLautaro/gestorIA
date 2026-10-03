import { NotFoundError } from '../../shared/domain/errors.js';
import type { Product } from '../domain/Product.js';
import type { ProductRepository } from '../domain/ProductRepository.js';

/**
 * Loads the owner's product or throws `NotFoundError`.
 * A product owned by someone else is reported as missing to avoid leaking its existence.
 */
export async function findOwnedProduct(
  products: ProductRepository,
  ownerId: string,
  id: string,
): Promise<Product> {
  const product = await products.findById(ownerId, id);
  if (!product) {
    throw new NotFoundError('product', id);
  }
  return product;
}
