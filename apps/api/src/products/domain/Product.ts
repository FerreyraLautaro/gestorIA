import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../shared/domain/errors.js';

export type ProductStatus = 'active' | 'inactive';

export interface CreateProductProps {
  ownerId: string;
  name: string;
  description?: string | undefined;
  /** Whole Argentine pesos (ARS); integer >= 0. */
  price: number;
  stock: number;
}

/** Fields that can change after creation. Omitted fields keep their current value. */
export interface ProductChanges {
  name?: string | undefined;
  /** An empty or blank value clears the description. */
  description?: string | undefined;
  price?: number | undefined;
  stock?: number | undefined;
  status?: ProductStatus | undefined;
}

const PRODUCT_STATUSES: readonly ProductStatus[] = ['active', 'inactive'];

/** Full state of a persisted product, used to rebuild it without re-running creation rules. */
export interface ProductState {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description?: string;
  readonly price: number;
  readonly stock: number;
  readonly status: ProductStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(state: ProductState) {
    this.id = state.id;
    this.ownerId = state.ownerId;
    this.name = state.name;
    if (state.description !== undefined) {
      this.description = state.description;
    }
    this.price = state.price;
    this.stock = state.stock;
    this.status = state.status;
    this.createdAt = state.createdAt;
    this.updatedAt = state.updatedAt;
  }

  /**
   * Rebuilds a product from trusted persisted state (e.g. a repository row).
   * Keeps the stored id, status and timestamps instead of generating new ones.
   */
  static restore(state: ProductState): Product {
    return new Product({
      ...state,
      createdAt: new Date(state.createdAt.getTime()),
      updatedAt: new Date(state.updatedAt.getTime()),
    });
  }

  /**
   * Returns a new product with the provided changes applied, validated like `create`.
   * Identity, ownership and createdAt never change; updatedAt is set to `now`.
   */
  update(changes: ProductChanges, now: Date = new Date()): Product {
    const provided = Object.values(changes).some((value) => value !== undefined);
    if (!provided) {
      throw new ValidationError('body', 'at least one field must be provided');
    }

    const { description: currentDescription, ...current } = this.currentState();
    const description =
      changes.description !== undefined
        ? optionalTrimmed(changes.description)
        : currentDescription;

    return new Product({
      ...current,
      ...(description !== undefined && { description }),
      ...(changes.name !== undefined && { name: requireNonBlank(changes.name, 'name') }),
      ...(changes.price !== undefined && {
        price: requireNonNegativeInteger(changes.price, 'price'),
      }),
      ...(changes.stock !== undefined && {
        stock: requireNonNegativeInteger(changes.stock, 'stock'),
      }),
      ...(changes.status !== undefined && { status: requireStatus(changes.status) }),
      updatedAt: new Date(now.getTime()),
    });
  }

  /** Returns an inactive copy of this product (soft delete). Idempotent. */
  deactivate(now: Date = new Date()): Product {
    return new Product({
      ...this.currentState(),
      status: 'inactive',
      updatedAt: new Date(now.getTime()),
    });
  }

  private currentState(): ProductState {
    return {
      id: this.id,
      ownerId: this.ownerId,
      name: this.name,
      ...(this.description !== undefined && { description: this.description }),
      price: this.price,
      stock: this.stock,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static create(props: CreateProductProps): Product {
    const ownerId = requireNonBlank(props.ownerId, 'ownerId');
    const name = requireNonBlank(props.name, 'name');
    const description = optionalTrimmed(props.description);
    const price = requireNonNegativeInteger(props.price, 'price');
    const stock = requireNonNegativeInteger(props.stock, 'stock');
    const now = new Date();

    return new Product({
      id: randomUUID(),
      ownerId,
      name,
      ...(description !== undefined && { description }),
      price,
      stock,
      status: 'active',
      createdAt: now,
      updatedAt: new Date(now.getTime()),
    });
  }
}

function requireNonBlank(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(field, `${field} must not be blank`);
  }
  return trimmed;
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(field, `${field} must be an integer greater than or equal to 0`);
  }
  return value;
}

function requireStatus(value: ProductStatus): ProductStatus {
  if (!PRODUCT_STATUSES.includes(value)) {
    throw new ValidationError('status', `status must be one of: ${PRODUCT_STATUSES.join(', ')}`);
  }
  return value;
}
