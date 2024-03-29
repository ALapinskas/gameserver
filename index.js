const isHttps = !!(process.env.CERT && process.env.KEY),
    http = isHttps ? require("https") : require("http"),
    socketIO = require("socket.io"),
    fs = require('fs'),
    PORT = process.env.PORT || 9000,
    INACTIVITY_TIME = 5000,
    EMPTY_ROOM_CHECK_TIMER = 5000,
    MAX_LOG_SIZE = 104857600;

let MAX_MESSAGES = 10;

const app = http.createServer(isHttps ? {
    cert: fs.readFileSync(process.env.CERT),
    key: fs.readFileSync(process.env.KEY)
} : {}).listen(PORT);

const roomsInfo = {};

setInterval(() => {
    removeEmptyRooms();
}, EMPTY_ROOM_CHECK_TIMER);

const io = socketIO(app, {
    cors: {
        origin: true,
        methods: ["GET", "POST"],
        transports: ["websocket", "polling"],
        credentials: true,
    },
    pingTimeout: INACTIVITY_TIME,
});

io.sockets.on("connect_error", (err) => {
    console.log("connection error: ", err.message);
});

io.sockets.on("connection", function (socket) {
    async function log(message, sendToClient = false) {
        const arrayLog = [new Date().toISOString() , "id: " + socket.id, message],
            stringLog = arrayLog.join(" | ");
            
        if (sendToClient) socket.emit("log", arrayLog);
        try {
            let stats,
                dir = "./logs";

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
                fs.writeFile("./logs/logs.txt", stringLog, err => {
                    if (err) console.error("error: ", err);
                });
            } else {

                stats = await fs.statSync("./logs/logs.txt");
            
                if(stats.isFile() && stats.size > MAX_LOG_SIZE) {
                    fs.writeFile("./logs/logs.txt", stringLog, err => {
                        if (err) console.error("error: ", err);
                    });
                } else if(stats.isFile()) {
                    fs.writeFile("./logs/logs.txt", "\n" + stringLog, { flag: 'a+' }, err => {
                        if (err) console.error("error: ", err);
                    });
                }
            }
        } catch (err) {
            if(err.code === 'ENOENT') {
                fs.writeFile("./logs/logs.txt", stringLog, err => {
                    if(err) console.error("error: ", err);
                });
            } else {
                console.error(err);
            }
        }
    }

    function messageProcessing(message) {
        socket.rooms.forEach((room) => {
            if (roomsInfo[room] && isCurrentSocketInRoom(room)) {
                if(!roomsInfo[room].messages) {
                    roomsInfo[room].messages = [message];
                } else if (roomsInfo[room].messages.length < MAX_MESSAGES) {
                    roomsInfo[room].messages.push(message);
                } else {
                    roomsInfo[room].messages.splice(0, 1);
                    roomsInfo[room].messages.push(message);
                }
                log("updated info:");
                log(JSON.stringify(roomsInfo));
                socket.broadcast.to(room).emit("message", message);
            }
        });
    }

    function isCurrentSocketInRoom(room) {
        return socket.adapter.rooms.get(room).has(socket.id);
    }

    socket.on("message", function (message) {
        log("Message from client: " + JSON.stringify(message));
        messageProcessing(message);
    });

    socket.on("gatherRoomsInfo", () => {
        log("gather rooms info received");
        socket.emit("roomsInfo", roomsInfo);
    });

    socket.on("restart", (state = {}) => {
        socket.rooms.forEach((room) => {
            if (roomsInfo[room] && isCurrentSocketInRoom(room)) {
                log("Received request to restart the room " + room);
                state.playersInRoom = roomsInfo[room].playersInRoom;
                roomsInfo[room] = state;
                io.sockets.in(room).emit("restarted", state);
            }
        });
    });

    socket.on("create or join", function (room, state = {}, maxPlayers = 2, maxMessages = 10) {
        log("Received request to create or join room " + room);
        if (roomsInfo[room]) {
            state = roomsInfo[room];
            state.playersInRoom.push(socket.id);
            log("state already exist in this room: ", state);
        } else {
            MAX_MESSAGES = maxMessages ? maxMessages : MAX_MESSAGES;
            state.playersInRoom = [socket.id];
            roomsInfo[room] = state;
        }
        ///////////
        log("client added");
        log(JSON.stringify(roomsInfo));
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        log("Room " + room + " now has " + numClients + " client(s)");

        if (numClients === 0) {
            socket.join(room);
            log("Client ID " + socket.id + " created room " + room);
            socket.emit("created", room, state);
        } else if (numClients < maxPlayers) {
            socket.join(room);
            log("Client ID " + socket.id + " joined room " + room);
            io.sockets.in(room).emit("joined", room, state);
        } else {
            socket.emit("full", room);
        }
        log("current rooms:", socket.rooms);
    });

    socket.on("disconnect", function (reason) {
        log("received bye");
        Object.keys(roomsInfo).forEach((room) => {
            let deletedSocketIndex = roomsInfo[room] && roomsInfo[room].playersInRoom ? roomsInfo[room].playersInRoom.indexOf(socket.id) : -1;
            if(deletedSocketIndex !== -1) {
                roomsInfo[room].playersInRoom.splice(deletedSocketIndex, 1);
                io.sockets.in(room).emit("disconnected", socket.id);
            }
        });
    });
});

function removeEmptyRooms() {
    Object.keys(roomsInfo).forEach((roomKey) => {
        if (roomsInfo[roomKey].playersInRoom.length === 0) {
            delete roomsInfo[roomKey];
        };
    });
}