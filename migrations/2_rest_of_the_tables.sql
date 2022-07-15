CREATE TABLE "worlds" (
  "id" serial PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "open" boolean NOT NULL
);

CREATE TABLE "bunkers" (
  "id" serial PRIMARY KEY,
  "user_id" int NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "world_id" int NOT NULL REFERENCES "worlds" ("id") ON DELETE CASCADE,
  "number" int NOT NULL,
  "x" int NOT NULL,
  "y" int NOT NULL,
  "data" jsonb NOT NULL,
  UNIQUE ("user_id", "world_id"),
  UNIQUE ("world_id", "number")
);

CREATE TABLE "bunker_locations" (
  "id" serial PRIMARY KEY,
  "bunker_id" int NOT NULL REFERENCES "bunkers" ("id") ON DELETE CASCADE,
  "location_id" int NULL,
  UNIQUE ("bunker_id", "location_id")
);

CREATE TABLE "expeditions" (
  "id" serial PRIMARY KEY,
  "bunker_id" int NOT NULL REFERENCES "bunkers" ("id") ON DELETE CASCADE,
  "location_id" int NULL,
  "zone_x" int NOT NULL,
  "zone_y" int NOT NULL,
  "eta" timestamptz NOT NULL,
  "data" jsonb NOT NULL
);

CREATE TABLE "inhabitants" (
  "id" serial PRIMARY KEY,
  "bunker_id" int NOT NULL REFERENCES "bunkers" ("id") ON DELETE CASCADE,
  "expedition_id" INT NULL REFERENCES "expeditions" ("id") ON DELETE SET NULL,
  "name" varchar(100) NOT NULL,
  "date_of_birth" date NOT NULL,
  "data" jsonb NOT NULL
);

CREATE TABLE "items" (
  "id" serial PRIMARY KEY,
  "bunker_id" int NOT NULL REFERENCES "bunkers" ("id") ON DELETE CASCADE,
  "item_type" varchar(50) NOT NULL,
  "quantity" int NOT NULL
);

CREATE TABLE "messages" (
  "id" serial PRIMARY KEY,
  "receiver_bunker_id" int NOT NULL REFERENCES "bunkers" ("id") ON DELETE CASCADE,
  "sender_bunker_id" int NULL REFERENCES "bunkers" ("id") ON DELETE SET NULL,
  "sender_name" varchar(100) NOT NULL,
  "subject" varchar(100) NOT NULL,
  "body" text NOT NULL,
  "created" timestamptz NOT NULL
);
