-- CreateEnum
CREATE TYPE "EventChannel" AS ENUM ('KIOSK', 'VR', 'WEB');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SESSION_START', 'SESSION_END', 'TOUR_OPEN', 'SCENE_VIEW', 'HOTSPOT_CLICK', 'AUDIO_PLAY', 'VR_ENTER', 'VR_EXIT', 'QR_SHOWN', 'LANG_CHANGE');

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "kioskId" UUID,
    "hotelId" UUID,
    "channel" "EventChannel" NOT NULL,
    "sessionId" UUID NOT NULL,
    "type" "EventType" NOT NULL,
    "tourId" UUID,
    "sceneId" UUID,
    "hotspotId" UUID,
    "lang" VARCHAR(8) NOT NULL,
    "durationMs" INTEGER,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id", "receivedAt")
) PARTITION BY RANGE ("receivedAt");

-- CreateIndex
CREATE INDEX "Event_hotelId_receivedAt_idx" ON "Event"("hotelId", "receivedAt");

-- CreateIndex
CREATE INDEX "Event_kioskId_receivedAt_idx" ON "Event"("kioskId", "receivedAt");

-- CreateIndex
CREATE INDEX "Event_tourId_receivedAt_idx" ON "Event"("tourId", "receivedAt");

-- CreateTable (partition DEFAULT)
CREATE TABLE "Event_default" PARTITION OF "Event" DEFAULT;

-- CreateFunction
CREATE OR REPLACE FUNCTION create_event_partition(month date)
RETURNS void AS $$
DECLARE
    v_start_date date;
    v_end_date date;
    v_partition_name text;
    v_start text;
    v_end text;
BEGIN
    v_start_date := date_trunc('month', month::timestamp)::date;
    v_end_date := (v_start_date + interval '1 month')::date;
    v_partition_name := 'Event_' || to_char(v_start_date, 'YYYY_MM');
    v_start := v_start_date::text || ' 00:00:00+00';
    v_end := v_end_date::text || ' 00:00:00+00';

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = v_partition_name
          AND n.nspname = current_schema()
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF "Event" FOR VALUES FROM (%L) TO (%L);',
            v_partition_name,
            v_start,
            v_end
        );
    END IF;
END;
$$ LANGUAGE plpgsql;
