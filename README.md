# gameserver
Simple nodejs server for multiuser usage: multiplayer games, chats, webrtc apps, etc. 
It allow creating independent sessions for users and delegate messages only inside them. 
Websocket and socket.io based.

# The idea
    Each session should have its own id, or name.
    Emitting a uniq id/name will create a new session. You will try to join that session, if the id/name is already exist.
    Emitting other messages will be delegated only to participants 
    joined to the same session.
    Inactive sessions will be automatically removed
   
# Using
# ServerSide http
    copy/paste files to your web-server
    npm i
    npm start
# ServerSide https
    For https connection you should provide valid certificate and cert key paths:
    CERT="/var/certs/cert.crt" KEY="/var/certs/cert.key" npm start
# Specify port
    PORT=9999 npm start
# ClientSide
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
     'connect_error' err          conn peer  Received, when client have connection troubles

# Run /examples/tic-tac-toe folder:
    1. Start server with http locally:
        npm start
    2. Navigate to /examples/tic-tac-toe
    3. Install node_modules:
        npm i
    4. Start client:
        npm start
    5. Visit http://localhost:8080

# Examples hosted:
    Tic-tac-toe, 2 player game: https://tictactoe.tw1.ru
    Webrtc video call app: https://webrtc.reslc.ru/

# ##############################################################################################
# ##############################################################################################

# gameserver
Простой nodejs сервер для: многопользовательских игр, чатов, приложений для видео-звонков, итд.
Позволяет создавать независимые сессии для пользователей и рассылать сообщения только внутри них.
Работает на вебсокетах и socket.io

# Идея
    Каждая сессия должна иметь свое уникальное имя/id
    Создавая сообщение с уникальным именем/id создаст новую сессию. Если имя/id уже существует,
    вы будете пытаться присоединится к этой сессии.
    Последующая рассылка будет производится только пользователям внутри этой сессии.
    Неактивные сессии автоматический удаляются.
   
# Использование
# Сервер http
    скопируйте содержимое на ваш сервер
    npm i
    npm start
# Сервер https
    Чтобы запустить сервер с https соединением нужно указать путь к валидному сертификату и ключу:
    CERT="/var/certs/cert.crt" KEY="/var/certs/cert.key" npm start
# Указать порт
    PORT=9999 npm start
# Клиент
    установите socket.io

    создайте соединение с сервером: 
    const socket = io(serverAddress, {withCredentials: true});

    отправляйте сообщения:
    socket.emit(event, parameters)
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

    Слушайте сообщения с сервера:
    socket.on(event, parameters)
    ______________________________________________________________________________
    |   event      | parameters | receiver | info                                |
    ______________________________________________________________________________
     'roomsInfo'     rooms:Array  conn peer  Получаем, после отправки gatherRoomsInfo
     'created'       room state   conn peer  Получаем, когда создается новая комната
     'joined'        room, state  all peers  Получаем, когда кто-то присоединяется к комнате  
     'full'          room         conn peer  Получаем, когда пытаются 
                                             присоединится к заполненной комнате
     'message'       message      all peers  Получаем, когда создают 'message' сообщение
     'disconnected'  socketId     all peers  Получаем, когда создают 'disconnects'
     'restarted'     state        all peers  Получаем, когда создают 'restart' сообщение и 
                                             текущее состояние сбрасывается
     'log'           message      conn peer  Отладочные сообщения
     'connect_error' err          conn peer  Получаем, когда на клиенте ошибки с подключением

# Запустить /examples/tic-tac-toe папку:
    1. Запустите http локально:
        npm start
    2. Перейдите в папку /examples/tic-tac-toe
    3. Установите node_modules:
        npm i
    4. Запустите клиент:
        npm start
    5. Запустите браузер и перейдите по адресу http://localhost:8080

# Примеры он-лайн:
    Крестики-нолики: https://tictactoe.tw1.ru
    Приложение для видео-звонков: https://webrtc.reslc.ru/