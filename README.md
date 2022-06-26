# gameserver
Websocket server to hold, and track users, and share data between them.

# Using
# Serverside
    copy/paste files to you web-server
    run npm i
    run npm start

# Clientside
    install socket.io, attach library

    connect to server from point 1 with socket.io lib: 
    const socket = io(serverAddress, {withCredentials: true});

    Use events to emit(socket.emit(event, parameters)):
    _________________________________________________
    |   event             | parameters              |
    _________________________________________________
    |   'gatherRoomsInfo' |                         |   
    |   'create or join'  | room:string, 
    |                     | map:Object = {},        |
    |                     | maxPlayers:number = 2   |
    |   'message'         | message:Object          |
    _________________________________________________ 

    events to listen(socket.on(event, parameters)):
    ______________________________________________________________________________
    |   event      | parameters | receiver | info                                |
    ______________________________________________________________________________
        'roomsInfo'  rooms:Array  conn peer  Received after gatherRoomsInfo will be emitted
        'created'    room map    conn peer   Received after a new room has been created    
        'joined'     room, map    all peers  Received when somebody joined to a room  
        'full'       room         conn peer  Received when tried to join for overflowed room
        'log'        message      conn peer  Debug logging
        'message'    message      all peers  Received, when somebody, emits 'message' event

# Recommended way to use:
    1. Connect to the socket(by default it will be running on 9000 port), handle the rooms information
    2. Connect to specific room, or create new one
    3. Send a 'message' event with information about peer actions
    4. Receive 'message' events from other peers, and perform actions  

# Examples
    Tic-tac-toe, 2 player game: http://results.webtm.ru/
