import { PAGINATION } from '../constants';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export function getPaginationParams(query: PaginationQuery) {
  const page = Math.max(1, query.page || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(query.limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
