import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AddressesService } from '../services/addresses.service';
import { CreateAddressDto, UpdateAddressDto } from '../dto/address.dto';

@ApiTags('Addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('addresses')
export class AddressesController {
  constructor(private addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List my saved addresses' })
  list(@CurrentUser('id') userId: string) {
    return this.addressesService.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new address' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved address' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved address' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addressesService.remove(userId, id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set an address as default' })
  setDefault(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addressesService.setDefault(userId, id);
  }
}
