ALTER TABLE "expeditions" DROP COLUMN "location_id";
ALTER TABLE "expeditions" ADD COLUMN "location_id" int NULL REFERENCES "locations" ("id") ON DELETE CASCADE;
