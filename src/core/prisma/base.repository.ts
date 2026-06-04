import { PrismaService } from './prisma.service';

export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaService) {}

  protected async paginate<T>(
    model: string,
    where: object,
    page: number,
    limit: number,
    options?: {
      orderBy?: object;
      include?: object;
      select?: object;
    },
  ): Promise<{ data: T[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this.prisma as any)[model].findMany({
        where,
        skip,
        take: limit,
        ...(options?.orderBy ? { orderBy: options.orderBy } : {}),
        ...(options?.include ? { include: options.include } : {}),
        ...(options?.select ? { select: options.select } : {}),
      }),
      (this.prisma as any)[model].count({ where }),
    ]);

    return { data, total };
  }
}
