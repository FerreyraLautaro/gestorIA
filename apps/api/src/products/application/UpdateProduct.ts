import type { Product, ProductChanges } from '../domain/Product.js';
import type { ProductRepository } from '../domain/ProductRepository.js';
import { findOwnedProduct } from './findOwnedProduct.js';

export interface UpdateProductInput {
  ownerId: string;
  id: string;
  changes: ProductChanges;
}

/** Applies a partial update to one of the owner's products and persists it. */
export class UpdateProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: UpdateProductInput): Promise<Product> {
    const product = await findOwnedProduct(this.products, input.ownerId, input.id);
    const updated = product.update(input.changes);
    await this.products.save(updated);
    return updated;
  }
}
