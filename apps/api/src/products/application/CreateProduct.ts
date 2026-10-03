import { Product } from '../domain/Product.js';
import type { ProductRepository } from '../domain/ProductRepository.js';

export interface CreateProductInput {
  ownerId: string;
  name: string;
  description?: string;
  /** Whole Argentine pesos (ARS); integer >= 0. */
  price: number;
  stock: number;
}

/** Creates an active product for the owner and persists it. */
export class CreateProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: CreateProductInput): Promise<Product> {
    const product = Product.create(input);
    await this.products.save(product);
    return product;
  }
}
