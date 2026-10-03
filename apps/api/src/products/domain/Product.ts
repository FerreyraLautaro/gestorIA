import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../shared/domain/errors.js';

export type ProductStatus = 'active' | 'inactive';

export interface CreateProductProps {
  ownerId: string;
  name: string;
  description?: string;
  /** Whole Argentine pesos (ARS); integer >= 0. */
  price: number;
  stock: number;
}

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
