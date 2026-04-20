import { Controller, Get, Param } from '@nestjs/common';
import { ConveniosService } from './convenios.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('convenios')
@Controller('convenios')
export class ConveniosController {
  constructor(private readonly conveniosService: ConveniosService) {}

  @Get()
  findAll() {
    return this.conveniosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conveniosService.findOne(id);
  }
}