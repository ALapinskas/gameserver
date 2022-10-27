# gameserver
Simple nodejs server for multiplayer games. It allows to create independent game sessions. Websocket based.

# The idea
    Each game session should have its own id, or name.
    Emitting a unic id/name will create a new session, if the id/name is already exist,
    you will try to join that session. 
    Emittting other messages will be delegated only to pariticipants 
    joined to the same session.
    Server side logging is included (by default maximim 100 mb).
   
# Using
# Serverside
    copy/paste files to your web-server
    run npm i
    run npm start

# Clientside
    install socket.io, attach library

    connect to server from point 1 with socket.io lib: 
    const socket = io(serverAddress, {withCredentials: true});

    Use events to emit(socket.emit(event, parameters)):
    _________________________________________________
    |   event             | parameters:type = default|
    _________________________________________________
    |   'gatherRoomsInfo' |                         |   
    |   'create or join'  | room:string,            |
    |                     | state:Object = {},      |
    |                     | maxPlayers:number = 2   |
    |                     | maxMessages:number = 10 |
    |   'restart'         | state:Object = {}       |
    |   'message'         | message:Object          |
    _________________________________________________ 

    events to listen(socket.on(event, parameters)):
    ______________________________________________________________________________
    |   event      | parameters | receiver | info                                |
    ______________________________________________________________________________
     'roomsInfo'     rooms:Array  conn peer  Received after gatherRoomsInfo will be emitted
     'created'       room state   conn peer  Received after a new room has been created    
     'joined'        room, state  all peers  Received when somebody joined to a room  
     'full'          room         conn peer  Received when tried to join for overflowed room
     'log'           message      conn peer  Debug logging
     'message'       message      all peers  Received, when somebody, emits 'message' event
     'disconnected'  socketId     all peers  Received, when somebody disconnects
     'restarted'     state        all peers  Received, when somebody emits 'restart' event, and
                                              resets the application state

# Recommended way to use:
    1. Connect to the socket(by default it will be running on 9000 port), get the roomsInfo with active rooms available.
    2. Connect to specific room, or create a new one
    3. Send a 'message' event with information about peer actions
    4. Receive 'message' events from other peers and perform actions  

# Examples
    Tic-tac-toe, 2 player game: http://results.webtm.ru/
