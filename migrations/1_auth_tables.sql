create table "users" (
    "id" bigserial primary key,
    "username" varchar(50) not null unique,
    "password" varchar(255) not null,
    "admin" boolean not null default false
);

create table "sessions" (
    "id" varchar(255) primary key,
    "user_id" bigint not null references "users" ("id") on delete cascade,
    "valid_until" timestamptz not null
);
