#!/bin/bash

rm cloasisLib.js
cat common/utils.js >> cloasisLib.js
cat common/sioSocket.js >> cloasisLib.js
cat common/connection.js >> cloasisLib.js
cat common/rpc.js >> cloasisLib.js
cat client/cloasis.js >> cloasisLib.js
cat socket.io.js >> cloasisLib.js

