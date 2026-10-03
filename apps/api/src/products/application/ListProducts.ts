import { ValidationError } from '../../shared/domain/errors.js';
import type { Product, ProductStatus } from '../domain/Product.js';
import type { ProductRepository } from '../domain/ProductRepository.js';

/** Page sizes accepted by product listings and the size used when none is given. */
export const PAGE_SIZES = {
  allowed: [5, 10, 20] as const,
  default: 10,
} as const;

export type PageSize = (typeof PAGE_SIZES.allowed)[number];

export interface ListProductsInput {
  ownerId: string;
  /** 1-based page number; defaults to 1. */
  page?: number;
  /** One of `PAGE_SIZES.allowed`; defaults to `PAGE_SIZES.default`. */
  pageSize?: number;
  /** Defaults to `active`: listings hide soft-deleted products unless asked for. */
  status?: ProductStatus;
}

export interface ListProductsResult {
  items: Product[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
}

/** Lists the owner's products, one page at a time, newest first. */
export class ListProducts {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: ListProductsInput): Promise<ListProductsResult> {
    const page = requirePage(input.page ?? 1);
    const pageSize = requirePageSize(input.pageSize ?? PAGE_SIZES.default);
    const status = input.status ?? 'active';

    const { items, total } = await this.products.list(input.ownerId, { page, pageSize, status });

    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}

function requirePage(page: number): number {
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError('page', 'page must be an integer greater than or equal to 1');
  }
  return page;
}

function requirePageSize(pageSize: number): PageSize {
  if (!isPageSize(pageSize)) {
    throw new ValidationError('pageSize', `pageSize must be one of: ${PAGE_SIZES.allowed.join(', ')}`);
  }
  return pageSize;
}

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES.allowed as readonly number[]).includes(value);
}
