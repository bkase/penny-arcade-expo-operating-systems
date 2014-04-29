#!/bin/bash

CMD="psql -d cloasis -c"

for i in `seq 0 2`; do
  DBNAME="cloasis${i}"
  createdb $DBNAME
  CMD="psql -d $DBNAME -c"
  echo $CMD
  $CMD 'CREATE TABLE apispecs (
    username       varchar(256),
    namespace      varchar(1024),
    version        real,
    name           varchar(256),
    description    text,
    examplesjson   text, -- JSON string
    inputspectype  int, -- id of it in 
    outputspectype int -- id
  );'

  $CMD 'CREATE TABLE specTypes (
    id     SERIAL,
    json   text
  );'

  $CMD 'CREATE TABLE users (
    username  varchar(256),
    passhash  char(64)
  );'
done

