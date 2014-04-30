#!/bin/bash

node-sql-generate --dsn "postgres://"$(whoami)"@localhost/cloasis0" --schema "public" > server/schema.js

