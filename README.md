# Underground Tomorrow

## Server

Create database

```sh
psql -U postgres
```

```sql
create database ut;
create role ut with login password 'ut';
grant all privileges on database ut to ut;
```

Create `.env`

```sh
RUST_BACKTRACE=1
RUST_LOG=debug,sqlx=warn
UT_SECRET_KEY=dev
UT_DATABASE=postgresql://ut:ut@localhost/ut
```

Run

```sh
cargo watch -x run
```

## Client

Install dependencies

```sh
npm install
```

Run dev server

```sh
npm run dev
```
