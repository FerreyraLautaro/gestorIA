import type { Product } from '../domain/Product.js';
import type { ProductRepository } from '../domain/ProductRepository.js';
import { findOwnedProduct } from './findOwnedProduct.js';

export interface GetProductInput {
  ownerId: string;
  id: string;
}

/** Returns one of the owner's products; throws `NotFoundError` otherwise. */
export class GetProduct {
  constructor(private readonly products: ProductRepository) {}

  execute(input: GetProductInput): Promise<Product> {
    return findOwnedProduct(this.products, input.ownerId, input.id);
  }
}
