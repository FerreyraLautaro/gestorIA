import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { DrizzleDb } from '../../shared/infrastructure/db/database.js';
import { Product } from '../domain/Product.js';
import type {
  ListProductsQuery,
  ProductPage,
  ProductRepository,
} from '../domain/ProductRepository.js';
import { products, type ProductRow } from './products.schema.js';

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: DrizzleDb) {}

  async save(product: Product): Promise<void> {
    const row = toRow(product);
    // Identity and ownership are immutable: an update never rewrites id, owner or createdAt.
    const { id: _id, ownerId: _ownerId, createdAt: _createdAt, ...changes } = row;
    const written = await this.db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({
        target: products.id,
        set: changes,
        setWhere: eq(products.ownerId, row.ownerId),
      })
      .returning({ id: products.id });

    if (written.length === 0) {
      throw new Error(`Product ${row.id} belongs to another owner and cannot be overwritten`);
    }
  }

  async findById(ownerId: string, id: string): Promise<Product | null> {
    const [row] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.ownerId, ownerId), eq(products.id, id)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async list(ownerId: string, query: ListProductsQuery): Promise<ProductPage> {
    const filters: SQL[] = [eq(products.ownerId, ownerId)];
    if (query.status !== undefined) {
      filters.push(eq(products.status, query.status));
    }
    const where = and(...filters);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(products)
        .where(where)
        .orderBy(desc(products.createdAt), desc(products.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ total: count() }).from(products).where(where),
    ]);

    return { items: rows.map(toDomain), total: totals?.total ?? 0 };
  }
}

function toRow(product: Product): ProductRow {
  return {
    id: product.id,
    ownerId: product.ownerId,
    name: product.name,
    description: product.description ?? null,
    price: product.price,
    stock: product.stock,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function toDomain(row: ProductRow): Product {
  return Product.restore({
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    ...(row.description !== null && { description: row.description }),
    price: row.price,
    stock: row.stock,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
