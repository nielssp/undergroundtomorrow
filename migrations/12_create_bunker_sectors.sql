CREATE TABLE "bunker_sectors" (
  "id" serial PRIMARY KEY,
  "bunker_id" int NOT NULL REFERENCES "bunkers" ("id") ON DELETE CASCADE,
  "x" int NOT NULL,
  "y" int NOT NULL,
  UNIQUE ("bunker_id", "x", "y")
);
