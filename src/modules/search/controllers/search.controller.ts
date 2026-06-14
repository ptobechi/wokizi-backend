import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SearchService } from '../services/search.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Public()
  @Get('services')
  @ApiOperation({ summary: 'Search and filter service listings' })
  @ApiQuery({ name: 'q',            required: false, description: 'Full-text query' })
  @ApiQuery({ name: 'category',     required: false, description: 'Category slug' })
  @ApiQuery({ name: 'categoryId',   required: false, description: 'Category UUID' })
  @ApiQuery({ name: 'minPrice',     required: false, type: Number })
  @ApiQuery({ name: 'maxPrice',     required: false, type: Number })
  @ApiQuery({ name: 'minRating',    required: false, type: Number, description: '3 | 4 | 5' })
  @ApiQuery({ name: 'verifiedOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'lat',          required: false, type: Number })
  @ApiQuery({ name: 'lng',          required: false, type: Number })
  @ApiQuery({ name: 'radius',       required: false, type: Number, description: 'km' })
  @ApiQuery({ name: 'page',         required: false, type: Number })
  @ApiQuery({ name: 'limit',        required: false, type: Number })
  searchServices(
    @Query('q')            q?: string,
    @Query('category')     category?: string,
    @Query('categoryId')   categoryId?: string,
    @Query('minPrice')     minPrice?: string,
    @Query('maxPrice')     maxPrice?: string,
    @Query('minRating')    minRating?: string,
    @Query('verifiedOnly') verifiedOnly?: string,
    @Query('lat')          lat?: string,
    @Query('lng')          lng?: string,
    @Query('radius')       radius?: string,
    @Query('page')         page?: string,
    @Query('limit')        limit?: string,
  ) {
    return this.searchService.searchServices({
      q, category, categoryId,
      minPrice:     minPrice     ? Number(minPrice)     : undefined,
      maxPrice:     maxPrice     ? Number(maxPrice)     : undefined,
      minRating:    minRating    ? Number(minRating)    : undefined,
      verifiedOnly: verifiedOnly === 'true',
      lat:          lat          ? Number(lat)          : undefined,
      lng:          lng          ? Number(lng)          : undefined,
      radius:       radius       ? Number(radius)       : undefined,
      page:         page         ? Number(page)         : undefined,
      limit:        limit        ? Number(limit)        : undefined,
    });
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete suggestions while typing' })
  @ApiQuery({ name: 'q', required: true })
  suggestions(@Query('q') q: string) {
    return this.searchService.getSuggestions(q);
  }

  @Public()
  @Get('popular')
  @ApiOperation({ summary: 'Popular service categories for discovery' })
  popular() {
    return this.searchService.getPopularSearches();
  }
}
