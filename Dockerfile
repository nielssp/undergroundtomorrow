
FROM rust:1.62.0 AS server-builder
WORKDIR /usr/src/
RUN rustup target add x86_64-unknown-linux-musl
RUN apt-get update && apt-get install -y clang musl-tools

RUN USER=root cargo new underground-tomorrow
WORKDIR /usr/src/underground-tomorrow
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release --target x86_64-unknown-linux-musl

COPY src ./src
COPY migrations ./migrations
RUN touch src/main.rs && cargo build --release --target x86_64-unknown-linux-musl

FROM alpine:3
WORKDIR /app
COPY --from=server-builder /usr/src/underground-tomorrow/target/x86_64-unknown-linux-musl/release/underground-tomorrow .
COPY data ./data
EXPOSE 8080
ENV UT_LISTEN=0.0.0.0:8080
CMD ["./underground-tomorrow"]
