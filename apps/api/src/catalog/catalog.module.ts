import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { CitiesController } from './cities.controller.js';
import { CitiesService } from './cities.service.js';
import { HotspotsController } from './hotspots.controller.js';
import { HotspotsService } from './hotspots.service.js';
import { ScenesController } from './scenes.controller.js';
import { ScenesService } from './scenes.service.js';
import { ToursController } from './tours.controller.js';
import { ToursService } from './tours.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    CitiesController,
    CategoriesController,
    ToursController,
    ScenesController,
    HotspotsController,
  ],
  providers: [CitiesService, CategoriesService, ToursService, ScenesService, HotspotsService],
})
export class CatalogModule {}
