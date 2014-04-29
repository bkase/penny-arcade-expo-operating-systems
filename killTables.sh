#!/bin/bash

CMD="psql -d cloasis -c"

for i in `seq 0 2`; do
  CMD="psql -d cloasis${i} -c"
  $CMD 'DROP TABLE apispecs;'
  $CMD 'DROP TABLE examples;'
  $CMD 'DROP TABLE specTypes;'
  $CMD 'DROP TABLE users;'
  $CMD 'DROP TABLE names;'
done

