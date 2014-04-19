#!/bin/bash

CMD="psql -d cloasis -c"

$CMD 'DROP TABLE apispecs;'
$CMD 'DROP TABLE examples;'
$CMD 'DROP TABLE specTypes;'
$CMD 'DROP TABLE users;'

