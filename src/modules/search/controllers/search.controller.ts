import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from '../services/search.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Public()
  @Get('services')
  @ApiOperation({ summary: 'Full-text search for services' })
  searchServices(
    @Query('q') q: string, @Query('category') category: string, @Query('city') city: string,
    @Query('state') state: string, @Query('minPrice') minPrice: number, @Query('maxPrice') maxPrice: number,
    @Query('lat') lat: number, @Query('lng') lng: number, @Query('radius') radius: number,
    @Query('page') page: number, @Query('limit') limit: number,
  ) {
    return this.searchService.searchServices({ q, category, city, state, minPrice, maxPrice, lat, lng, radius, page, limit });
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Get autocomplete suggestions' })
  suggestions(@Query('q') q: string) {
    return this.searchService.getSuggestions(q);
  }
}
