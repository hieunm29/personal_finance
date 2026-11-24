#!/bin/sh
# Khởi động container production: áp dụng migration rồi chạy server.
# `set -e` để migration lỗi thì container dừng, không chạy server trên DB sai schema.
set -e

bun run apps/server/src/db/migrate.ts
exec bun run apps/server/src/index.ts
