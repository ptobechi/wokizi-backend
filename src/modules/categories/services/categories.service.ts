import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../repositories/categories.repository';
import { generateSlug } from '../../../common/utils/slug.util';

export class CreateCategoryDto {
  name: string;
  description?: string;
  iconUrl?: string;
  parentId?: string;
  sortOrder?: number;
}

export class UpdateCategoryDto {
  name?: string;
  description?: string;
  iconUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable()
export class CategoriesService {
  constructor(private repo: CategoriesRepository) {}

  async create(dto: CreateCategoryDto) {
    const slug = generateSlug(dto.name);
    const existing = await this.repo.findBySlugUnique(slug);
    if (existing) throw new ConflictException('Category already exists');
    return this.repo.create({ ...dto, slug });
  }

  findAll() {
    return this.repo.findAll();
  }

  async findOne(slug: string) {
    const cat = await this.repo.findBySlug(slug);
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Category not found');
    const data: any = { ...dto };
    if (dto.name) data.slug = generateSlug(dto.name);
    return this.repo.update(id, data);
  }

  async remove(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Category not found');
    await this.repo.deactivate(id);
    return { message: 'Category deactivated' };
  }
}
