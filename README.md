# The Readme

# The Plan

## The Spec
  
NOTE THIS IS OLD DO NOT LISTEN
  name is type
  input is data


* socket based (websockets / tcp)
* send JSON message prefixed with length

```javascript
{
  type: the type
  data: the data
}
```

note the
    requestId: some number
    resultId: some number

    {
      requestId: whateva,
      data: the thing below,
    },

    {
      resultId: whateva,
      data: the thing below,
    }

also its all wss

loginUser
  {
    username: _,
    password: _,
  }
    ->
  {
    err: null
  }
  
registerUser
  {
    username: _,
    password: _,
    //some user verification later?
  }
    ->
  {
    err: null
  }

searchAPIs
  this takes query parameters, and returns a list of <API specifications>.
  {
    type: "search",
    query: "thing_to_contain",
  } 
    ->
  {
    apis: [
      apiSpec1,
      apiSpec2,
    ],
    err: null
  }

infoAPIs
  this takes the unique identifiers of APIs, and returns those <API's specifications>
  {
    type: "info",
    apiIndentifiers: [
      [ namespace, name, version ],
      [ namespace, name, version ],
      [ namespace, name, version ],
    ]
  }
    ->
  {
    apis: [
      apiSpec1,
      apiSpec2,
      apiSpec3,
    ],
    err: null
  }
callAPI
  this takes the unique identifier of an API and its input, and returns the output
  {
    type: "call",
    apiIndentifier: [ namespace, name, version ],
    input: {
      ...
    }
  }
    ->
  {
    output: {
      ...
    },
    err: null
  }

registerAPIs
  this adds APIs to the database
  {
    type: "register",
    apiSpecs: [
      {
        ...
      }
    ]
  }
    ->
  {
    err: null
  }

activateAPI
  {
    type: "activate",
    apiIdentifiers: [
      [ namespace, name, version ],
      [ namespace, name, version ],
      [ namespace, name, version ],
    ]
  }
    ->
  {
    err: null
  }

deactivateAPI
  {
    type: "deactivate",
    apiIdentifiers: [
      [ namespace, name, version ],
      [ namespace, name, version ],
      [ namespace, name, version ],
    ]
  }
    ->
  {
    err: null
  }

apiSpec
  {
    username: String,
    namespace: String,
    version: Number, 
    name: String,
    description: String
    examples: [
      {
        description: html,
        input: { ... }
        output: { ... }
      },
      ...
    ],
    inputSpec: {
      a: String,
      b: Number,
      c: Boolean,
      d: {
        x: 3,
        y: 1,
      },
    },
    outputSpec: {
      a: String,
      b: Number,
      c: Boolean,
      d: {
        x: 3,
        y: 1,
      },
    }
  }


## client library

```javascript
  var Cloasis = require('cloasis');
  Cloasis.register(username, password, onSession);
  Cloasis.login(username, password, onSession);

  function onSession(err, session){
    session.search(...
    session.register(...
  }
```

## server

```javascript
  function onSocket(socket){
    socket.on('register', function(requestId, input){
      socket.send(requestId, output)
      look in SQL database and stuff
    });

    socket.on('login', function(){
      look in SQL database and stuff
    });

    socket.on('search', function(){
      look in SQL database and stuff
    });

    socket.on('call', function(requestId, apiIdentifier, input){
      findServer(apiIdentifier, function(err, server){
        callOnServer(server, apIdentifier, function(output){
          socket.send(requestId, output)
        });

      });
      find what server, and send req to them
    });
  }

  function runCallOnBehalfOfOtherServer(resultCb){
      1. find what socket to use
      2. enqueue then socket

  }
```
