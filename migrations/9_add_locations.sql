DROP TABLE "bunker_locations";

CREATE TABLE "locations" (
  "id" serial PRIMARY KEY,
  "world_id" int NOT NULL REFERENCES "worlds" ("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "x" int NOT NULL,
  "y" int NOT NULL,
  "data" jsonb NOT NULL
);

CREATE TABLE "bunker_locations" (
  "id" serial PRIMARY KEY,
  "bunker_id" int NOT NULL REFERENCES "bunkers" ("id") ON DELETE CASCADE,
  "location_id" int NOT NULL REFERENCES "locations" ("id") ON DELETE CASCADE,
  UNIQUE ("bunker_id", "location_id")
);
