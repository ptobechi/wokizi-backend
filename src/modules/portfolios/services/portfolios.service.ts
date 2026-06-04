import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PortfoliosRepository } from '../repositories/portfolios.repository';
import { CreatePortfolioItemDto } from '../dto/requests/create-portfolio-item.dto';

@Injectable()
export class PortfoliosService {
  constructor(private repo: PortfoliosRepository) {}

  async addItem(userId: string, dto: CreatePortfolioItemDto) {
    const portfolio = await this.repo.getOrCreate(userId);
    return this.repo.createItem(portfolio.id, dto);
  }

  getItems(userId: string, serviceId?: string) {
    return this.repo.findItems(userId, serviceId);
  }

  async removeItem(itemId: string, userId: string) {
    const portfolio = await this.repo.getOrCreate(userId);
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundException('Portfolio item not found');
    if (item.portfolioId !== portfolio.id) throw new ForbiddenException('Not your portfolio item');
    await this.repo.deleteItem(itemId);
    return { message: 'Item removed' };
  }

  getPublicPortfolio(userId: string) {
    return this.repo.findPublic(userId);
  }
}
