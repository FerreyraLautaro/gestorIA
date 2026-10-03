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

/** Body of `PUT/PATCH /products/{id}`: every field is optional. */
export type UpdateProductRequest = Partial<CreateProductRequest>;

/** Pagination metadata for list responses. */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

/** Response of `GET /products`. */
export interface ProductListResponse {
  items: ProductResponse[];
  pagination: Pagination;
}
