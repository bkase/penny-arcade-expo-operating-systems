#!/bin/bash

CMD="psql -d cloasis -c"

$CMD 'CREATE TABLE apispecs (
  userId         int,
  namespace      varchar(1024),
  version        real,
  name           varchar(256),
  exampleCSVs    text, -- CSV of integers
  inputSpecType  int, -- id of it in 
  outputSpecType int -- id
);'

$CMD 'CREATE TABLE examples (
  description   text,
  inputJson     text, -- JSON string
  outputJson    text  -- JSON string
);'

$CMD 'CREATE TABLE specTypes (
  id     int,
  json   text
);'

$CMD 'CREATE TABLE names (
  id        int,
  username  varchar(256)
);'
