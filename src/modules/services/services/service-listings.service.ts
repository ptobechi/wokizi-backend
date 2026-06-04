import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ServiceStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ServicesRepository } from '../repositories/services.repository';
import { CreateServiceDto, UpdateServiceDto } from '../dto/requests/create-service.dto';
import { generateUniqueSlug } from '../../../common/utils/slug.util';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';

@Injectable()
export class ServiceListingsService {
  constructor(
    private repo: ServicesRepository,
    private prisma: PrismaService,
  ) {}

  async create(userId: string, dto: CreateServiceDto) {
    const { images, availabilitySlots, ...data } = dto;

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    return this.repo.create({
      ...data,
      slug: generateUniqueSlug(dto.title),
      providerId: userId,
      status: ServiceStatus.DRAFT,
      images: images?.length ? { create: images.map((img, i) => ({ ...img, sortOrder: i, isPrimary: i === 0 })) } : undefined,
      availability: availabilitySlots?.length ? { create: { slots: { create: availabilitySlots } } } : undefined,
    });
  }

  async submit(serviceId: string, userId: string) {
    const service = await this.getOwned(serviceId, userId);
    if (service.status !== ServiceStatus.DRAFT && service.status !== ServiceStatus.REJECTED) {
      throw new BadRequestException('Only DRAFT or REJECTED services can be submitted');
    }
    const verification = await this.prisma.verification.findUnique({ where: { userId } });
    if (!verification || verification.status !== VerificationStatus.APPROVED) {
      throw new BadRequestException('Provider verification required before submitting');
    }
    return this.repo.update(serviceId, { status: ServiceStatus.PENDING_REVIEW });
  }

  async publish(serviceId: string, userId: string) {
    const service = await this.getOwned(serviceId, userId);
    if (service.status !== ServiceStatus.APPROVED) throw new BadRequestException('Only APPROVED services can be published');
    return this.repo.update(serviceId, { isPublished: true });
  }

  async unpublish(serviceId: string, userId: string) {
    await this.getOwned(serviceId, userId);
    return this.repo.update(serviceId, { isPublished: false });
  }

  async update(serviceId: string, userId: string, dto: UpdateServiceDto) {
    const service = await this.getOwned(serviceId, userId);
    if (service.status === ServiceStatus.PENDING_REVIEW) throw new BadRequestException('Cannot edit while under review');
    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new NotFoundException('Category not found');
    }
    return this.repo.update(serviceId, { ...dto, status: ServiceStatus.DRAFT });
  }

  async findMyServices(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findAllByProvider(userId, skip, limit),
      this.repo.countByProvider(userId),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(slug: string, requesterId?: string) {
    const service = await this.repo.findBySlugPublic(slug);
    if (!service) throw new NotFoundException('Service not found');

    this.repo.incrementViewCount(service.id).catch(() => {});

    let isSaved = false;
    let isLiked = false;
    if (requesterId) {
      const [saved, liked] = await Promise.all([
        this.prisma.savedService.findUnique({ where: { userId_serviceId: { userId: requesterId, serviceId: service.id } } }),
        this.prisma.serviceLike.findUnique({ where: { userId_serviceId: { userId: requesterId, serviceId: service.id } } }),
      ]);
      isSaved = !!saved;
      isLiked = !!liked;
    }

    return { ...service, isSaved, isLiked };
  }

  async delete(serviceId: string, userId: string) {
    await this.getOwned(serviceId, userId);
    await this.repo.softDelete(serviceId);
    return { message: 'Service deleted' };
  }

  private async getOwned(serviceId: string, userId: string) {
    const service = await this.repo.findById(serviceId);
    if (!service) throw new NotFoundException('Service not found');
    if (service.providerId !== userId) throw new ForbiddenException('Not your service');
    return service;
  }
}
