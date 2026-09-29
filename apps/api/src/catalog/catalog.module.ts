import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { CitiesController } from './cities.controller.js';
import { CitiesService } from './cities.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CitiesController, CategoriesController],
  providers: [CitiesService, CategoriesService],
})
export class CatalogModule {}
