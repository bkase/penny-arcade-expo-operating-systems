README for Cloasis
bkase
eashapir

NOTES

We haven't changed anything since our presentation.

SUMMARY

Cloasis is a service for connecting people who have solutions to problems (exposed as a function through an API) with people who want to call those functions. This system is built entirely using JavaScript through Node.JS

We built the system on top of Multi-Paxos with dynamic failure recovery. Paxos is used to safely replicate and maintain state in lock-step for PostgreSQL, and to esnure that all servers know what APIs are activated or deactivated at a certain time. Our Paxos and the rest of the system is built on-top of a custom RPC implementation that runs over WebSockets.

Our system supports user registration, login, api registration, searching for APIs, getting more info about specific APIs, marking or unmarking certain APIs as active, and of course calling the APIs.

We also built an example application where a user of a Google Glass can say "Ok Glass, look through Living Room" or "Ok Glass, look through Kitchen" and a hosted activated takePicture() method on specific devices registered in different areas of our house will be called and the images will be sent to the Google Glass.


HOW TO RUN

Prereqs:
cd paxos
Use a *nix system
Install PostgreSQL
Get Node.JS and run npm install
npm install -g sql-generate
run ./makeTables.sh
run ./genSchema.sh

Tests for paxos:

node server/paxosTest.js 
(the tests are of the form [X, Y, name], it means run Paxos with X nodes with a drop rate of Y -- however this can be overriden in specific tests -- and execute test name)

Tests for whole system:

node server/testClient.js

Application:

node startServer.js
then run node client/client.js or the Android Apps

Android Apps:

Open IntelliJ with Android SDK (see internet) and import modules to workspace
Get guava libs, put in libs folder
Build phone app to an Android phone
Build glass app to Google Glass
Run phone app (give it a few seconds to load everything and register user/register api/activate api in the system)
Run glass app and ask for a room associated with the phone model (it's hardcoded in a map in LookingGlassGlass/BaseMainActivity

