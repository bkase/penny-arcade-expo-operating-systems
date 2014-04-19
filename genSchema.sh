#!/bin/bash

node-sql-generate --dsn "postgres://"$(whoami)"@localhost/cloasis" --schema "public" > server/schema.js

