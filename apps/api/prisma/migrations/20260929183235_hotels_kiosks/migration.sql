-- CreateEnum
CREATE TYPE "HotelStars" AS ENUM ('FOUR', 'FIVE', 'LUXURY');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SALE', 'RENTAL');

-- CreateEnum
CREATE TYPE "KioskDeviceType" AS ENUM ('TOUCH_SCREEN', 'VR_HEADSET', 'TOUCH_AND_HEADSET');

-- CreateEnum
CREATE TYPE "KioskStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "Hotel" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stars" "HotelStars" NOT NULL,
    "cityId" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "logoAssetId" UUID,
    "brandColor" TEXT NOT NULL,
    "languages" TEXT[] DEFAULT ARRAY['fr']::TEXT[],
    "contractType" "ContractType" NOT NULL,
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3) NOT NULL,
    "maintenancePinHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "featuredTourId" UUID,
    "attractTourIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionItem" (
    "id" UUID NOT NULL,
    "selectionId" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kiosk" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "hotelId" UUID NOT NULL,
    "deviceType" "KioskDeviceType" NOT NULL,
    "status" "KioskStatus" NOT NULL DEFAULT 'PENDING',
    "enrollmentCode" VARCHAR(8),
    "enrollmentExpiresAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastIp" TEXT,
    "appVersion" TEXT,
    "syncedManifestVersion" TEXT,
    "storageFreeMb" INTEGER,
    "idleTimeoutSeconds" INTEGER NOT NULL DEFAULT 90,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kiosk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHotel" (
    "userId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserHotel_pkey" PRIMARY KEY ("userId","hotelId")
);

-- CreateIndex
CREATE INDEX "Hotel_cityId_idx" ON "Hotel"("cityId");

-- CreateIndex
CREATE INDEX "Hotel_logoAssetId_idx" ON "Hotel"("logoAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_hotelId_key" ON "Selection"("hotelId");

-- CreateIndex
CREATE INDEX "Selection_featuredTourId_idx" ON "Selection"("featuredTourId");

-- CreateIndex
CREATE INDEX "SelectionItem_selectionId_idx" ON "SelectionItem"("selectionId");

-- CreateIndex
CREATE INDEX "SelectionItem_tourId_idx" ON "SelectionItem"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "SelectionItem_selectionId_tourId_key" ON "SelectionItem"("selectionId", "tourId");

-- CreateIndex
CREATE UNIQUE INDEX "Kiosk_enrollmentCode_key" ON "Kiosk"("enrollmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Kiosk_tokenHash_key" ON "Kiosk"("tokenHash");

-- CreateIndex
CREATE INDEX "Kiosk_hotelId_idx" ON "Kiosk"("hotelId");

-- CreateIndex
CREATE INDEX "UserHotel_hotelId_idx" ON "UserHotel"("hotelId");

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_featuredTourId_fkey" FOREIGN KEY ("featuredTourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kiosk" ADD CONSTRAINT "Kiosk_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHotel" ADD CONSTRAINT "UserHotel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHotel" ADD CONSTRAINT "UserHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
