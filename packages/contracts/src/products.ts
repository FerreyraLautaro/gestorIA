/** Lifecycle status of a product. `inactive` is also the soft-delete state. */
export type ProductStatus = 'active' | 'inactive';

/**
 * Product as returned by the API.
 * `ownerId` is intentionally absent: it is derived from the token server-side.
 * Timestamps are ISO 8601 strings.
 */
export interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

/** Body of `POST /products`. */
export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  stock: number;
  status?: ProductStatus;
}

/** Body of `PATCH /products/{id}`: only the fields sent are updated. */
export type UpdateProductRequest = Partial<CreateProductRequest>;

/** Page sizes accepted by `GET /products?pageSize=`. */
export type PageSize = 5 | 10 | 20;

/** Pagination metadata for list responses. `page` starts at 1. */
export interface Pagination {
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
}

/** Response of `GET /products`. */
export interface ProductListResponse {
  items: ProductResponse[];
  pagination: Pagination;
}
