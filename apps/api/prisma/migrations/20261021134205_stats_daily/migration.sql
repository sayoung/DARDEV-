-- CreateTable
CREATE TABLE "StatsDaily" (
    "id" BIGSERIAL NOT NULL,
    "day" DATE NOT NULL,
    "bucketKey" VARCHAR(128) NOT NULL,
    "hotelId" UUID,
    "tourId" UUID,
    "channel" "EventChannel" NOT NULL,
    "lang" VARCHAR(8) NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "toursOpened" INTEGER NOT NULL DEFAULT 0,
    "scenesViewed" INTEGER NOT NULL DEFAULT 0,
    "hotspotClicks" INTEGER NOT NULL DEFAULT 0,
    "audioPlays" INTEGER NOT NULL DEFAULT 0,
    "vrEntries" INTEGER NOT NULL DEFAULT 0,
    "qrShown" INTEGER NOT NULL DEFAULT 0,
    "sessionDurationMs" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatsDaily_hotelId_day_idx" ON "StatsDaily"("hotelId", "day");

-- CreateIndex
CREATE INDEX "StatsDaily_tourId_day_idx" ON "StatsDaily"("tourId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "StatsDaily_day_bucketKey_key" ON "StatsDaily"("day", "bucketKey");
