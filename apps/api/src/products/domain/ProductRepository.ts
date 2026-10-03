import type { Product, ProductStatus } from './Product.js';

export interface ListProductsQuery {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  /** When omitted, products of every status are returned. */
  status?: ProductStatus;
}

export interface ProductPage {
  items: Product[];
  /** Number of products matching the query across all pages. */
  total: number;
}

/** Persistence port for products. Every read is scoped by the owning account. */
export interface ProductRepository {
  /** Inserts the product, or updates the stored one with the same id. */
  save(product: Product): Promise<void>;
  /** Returns null when the product does not exist or belongs to another owner. */
  findById(ownerId: string, id: string): Promise<Product | null>;
  /** Lists the owner's products ordered by createdAt desc, then id desc. */
  list(ownerId: string, query: ListProductsQuery): Promise<ProductPage>;
}
