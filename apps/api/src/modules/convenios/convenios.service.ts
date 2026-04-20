import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ConveniosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.convenio.findMany();
  }

  async findOne(id: string) {
    return this.prisma.convenio.findUnique({ where: { id } });
  }
}