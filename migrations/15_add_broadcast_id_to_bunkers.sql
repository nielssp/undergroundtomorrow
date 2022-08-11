ALTER TABLE "bunkers" ADD COLUMN "broadcast_id" varchar(100) NULL;

UPDATE "bunkers" SET "broadcast_id" = md5(random()::varchar);

ALTER TABLE "bunkers" ALTER COLUMN "broadcast_id" SET NOT NULL;
ALTER TABLE "bunkers" ADD UNIQUE ("broadcast_id");
