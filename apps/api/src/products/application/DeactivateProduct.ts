import type { ProductRepository } from '../domain/ProductRepository.js';
import { findOwnedProduct } from './findOwnedProduct.js';

export interface DeactivateProductInput {
  ownerId: string;
  id: string;
}

/** Soft deletes one of the owner's products by marking it inactive. */
export class DeactivateProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: DeactivateProductInput): Promise<void> {
    const product = await findOwnedProduct(this.products, input.ownerId, input.id);
    await this.products.save(product.deactivate());
  }
}
