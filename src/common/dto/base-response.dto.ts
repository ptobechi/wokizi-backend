export class PaginatedMetaDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginatedMetaDto;

  static of<T>(data: T[], total: number, page: number, limit: number): PaginatedResponseDto<T> {
    const totalPages = Math.ceil(total / limit);
    const res = new PaginatedResponseDto<T>();
    res.data = data;
    res.meta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
    return res;
  }
}
