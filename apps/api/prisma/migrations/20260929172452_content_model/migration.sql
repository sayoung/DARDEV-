-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "HotspotType" AS ENUM ('SCENE_LINK', 'TOUR_LINK', 'INFO', 'MEDIA', 'URL');

-- CreateEnum
CREATE TYPE "HotspotIcon" AS ENUM ('ARROW', 'INFO', 'PHOTO', 'PLAY', 'PORTAL');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('PANORAMA', 'IMAGE', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "City" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "originalKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "contentHash" TEXT NOT NULL,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "derivatives" JSONB NOT NULL DEFAULT '{}',
    "copyright" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tour" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "description" JSONB,
    "cityId" UUID NOT NULL,
    "coverAssetId" UUID NOT NULL,
    "startSceneId" UUID,
    "durationMinutes" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "practicalInfo" JSONB,
    "shareToken" VARCHAR(22),
    "publicShare" BOOLEAN NOT NULL DEFAULT false,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "TourStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourCategory" (
    "id" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "caption" JSONB,
    "panoramaAssetId" UUID NOT NULL,
    "initialYaw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialPitch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialZoom" INTEGER NOT NULL DEFAULT 50,
    "narration" JSONB,
    "ambientAssetId" UUID,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "weight" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotspot" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "type" "HotspotType" NOT NULL,
    "yaw" DOUBLE PRECISION NOT NULL,
    "pitch" DOUBLE PRECISION NOT NULL,
    "label" JSONB NOT NULL,
    "targetSceneId" UUID,
    "targetTourId" UUID,
    "targetTourSceneId" UUID,
    "body" JSONB,
    "mediaAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url" TEXT,
    "icon" "HotspotIcon" NOT NULL,
    "arrivalYaw" DOUBLE PRECISION,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotspot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tour_shareToken_key" ON "Tour"("shareToken");

-- CreateIndex
CREATE INDEX "Tour_cityId_idx" ON "Tour"("cityId");

-- CreateIndex
CREATE INDEX "Tour_coverAssetId_idx" ON "Tour"("coverAssetId");

-- CreateIndex
CREATE INDEX "Tour_startSceneId_idx" ON "Tour"("startSceneId");

-- CreateIndex
CREATE INDEX "Tour_createdById_idx" ON "Tour"("createdById");

-- CreateIndex
CREATE INDEX "TourCategory_tourId_idx" ON "TourCategory"("tourId");

-- CreateIndex
CREATE INDEX "TourCategory_categoryId_idx" ON "TourCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TourCategory_tourId_categoryId_key" ON "TourCategory"("tourId", "categoryId");

-- CreateIndex
CREATE INDEX "Scene_tourId_idx" ON "Scene"("tourId");

-- CreateIndex
CREATE INDEX "Scene_panoramaAssetId_idx" ON "Scene"("panoramaAssetId");

-- CreateIndex
CREATE INDEX "Scene_ambientAssetId_idx" ON "Scene"("ambientAssetId");

-- CreateIndex
CREATE INDEX "Scene_createdById_idx" ON "Scene"("createdById");

-- CreateIndex
CREATE INDEX "Hotspot_sceneId_idx" ON "Hotspot"("sceneId");

-- CreateIndex
CREATE INDEX "Hotspot_targetSceneId_idx" ON "Hotspot"("targetSceneId");

-- CreateIndex
CREATE INDEX "Hotspot_targetTourId_idx" ON "Hotspot"("targetTourId");

-- CreateIndex
CREATE INDEX "Hotspot_targetTourSceneId_idx" ON "Hotspot"("targetTourSceneId");

-- CreateIndex
CREATE INDEX "Hotspot_createdById_idx" ON "Hotspot"("createdById");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_startSceneId_fkey" FOREIGN KEY ("startSceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourCategory" ADD CONSTRAINT "TourCategory_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourCategory" ADD CONSTRAINT "TourCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_panoramaAssetId_fkey" FOREIGN KEY ("panoramaAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_ambientAssetId_fkey" FOREIGN KEY ("ambientAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_targetSceneId_fkey" FOREIGN KEY ("targetSceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_targetTourId_fkey" FOREIGN KEY ("targetTourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_targetTourSceneId_fkey" FOREIGN KEY ("targetTourSceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
