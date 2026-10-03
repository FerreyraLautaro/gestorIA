import { Product } from '../../domain/Product.js';
import type {
  ListProductsQuery,
  ProductPage,
  ProductRepository,
} from '../../domain/ProductRepository.js';

/**
 * Test double for the product port with the same semantics as the Drizzle adapter:
 * owner-scoped reads, createdAt desc then id desc ordering, immutable id/owner/createdAt.
 */
export class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();

  async save(product: Product): Promise<void> {
    const existing = this.products.get(product.id);
    if (existing && existing.ownerId !== product.ownerId) {
      throw new Error(`Product ${product.id} belongs to another owner and cannot be overwritten`);
    }
    this.products.set(
      product.id,
      Product.restore({
        ...stateOf(product),
        createdAt: existing?.createdAt ?? product.createdAt,
      }),
    );
  }

  async findById(ownerId: string, id: string): Promise<Product | null> {
    const product = this.products.get(id);
    return product && product.ownerId === ownerId ? copy(product) : null;
  }

  async list(ownerId: string, query: ListProductsQuery): Promise<ProductPage> {
    const matching = [...this.products.values()]
      .filter((product) => product.ownerId === ownerId)
      .filter((product) => query.status === undefined || product.status === query.status)
      .sort(byCreatedAtDescThenIdDesc);
    const offset = (query.page - 1) * query.pageSize;

    return {
      items: matching.slice(offset, offset + query.pageSize).map(copy),
      total: matching.length,
    };
  }
}

function byCreatedAtDescThenIdDesc(a: Product, b: Product): number {
  const byDate = b.createdAt.getTime() - a.createdAt.getTime();
  if (byDate !== 0) {
    return byDate;
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function copy(product: Product): Product {
  return Product.restore(stateOf(product));
}

function stateOf(product: Product) {
  return {
    id: product.id,
    ownerId: product.ownerId,
    name: product.name,
    ...(product.description !== undefined && { description: product.description }),
    price: product.price,
    stock: product.stock,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
