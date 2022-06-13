const http = require("http");
const socketIO = require("socket.io");
const fs = require('fs');
const PORT = process.env.PORT || 9000;
const INACTIVITY_TIME = 5000;

const app = http.createServer().listen(PORT);
const roomsInfo = {};
const io = socketIO(app, {
    cors: {
        origin: true,
        methods: ["GET", "POST"],
        transports: ["websocket", "polling"],
        credentials: true,
    },
    pingTimeout: INACTIVITY_TIME,
});

io.sockets.on("connection", function (socket) {
    async function log(message, sendToClient = false) {
        const arrayLog = [new Date(), socket.id, "Message from server: ", message],
            stringLog = arrayLog.join(" | ");
            
        console.log("log: ", stringLog);
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
            
                if(stats.isFile() && stats.size > 1024000) {
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
        if (socket.disconnected === true) {
            log("remove rooms info for id: ", socket.id);
            log(socket.adapter.rooms);
            socket.adapter.rooms.forEach((roomInfo, room) => {
                if (roomsInfo[room]) {
                    log(
                        "disconnect message processing, broadcast to ",
                        socket.id
                    );
                    socket.broadcast
                        .to(room)
                        .emit("removed", roomsInfo[room][socket.id]);
                    socket.leave(room);
                    delete roomsInfo[room][socket.id];
                    log("disconnected");
                    log(roomsInfo[room]);
                }
            });
        }
        socket.rooms.forEach((room) => {
            if (roomsInfo[room] && message === "disconnect") {
                log(
                    "disconnect message processing, broadcast to ",
                    socket.id
                );
                socket.broadcast
                    .to(room)
                    .emit("removed", roomsInfo[room][socket.id]);
                socket.leave(room);
                delete roomsInfo[room][socket.id];
                log("disconnected");
                log(roomsInfo[room]);
            } else if (roomsInfo[room] && isCurrentSocketInRoom(room)) {
                roomsInfo[room][socket.id] = message;
                log("updated info:");
                log(JSON.stringify(roomsInfo));
                socket.broadcast.to(room).emit("message", message);
            }
        });
    }

    function isCurrentSocketInRoom(room) {
        return Object.prototype.hasOwnProperty.call(roomsInfo[room], socket.id);
    }

    socket.on("message", function (message) {
        if(message.type !== "move") {
            log("Message from client: " + JSON.stringify(message));
        }
        messageProcessing(message);
    });

    socket.on("gatherRoomsInfo", () => {
        log("gather rooms info received");
        socket.emit("roomsInfo", roomsInfo);
    });

    socket.on("create or join", function (room, map = {}, maxPlayers = 2) {
        log("Received request to create or join room " + room);
        if (roomsInfo[room]) {
            map = roomsInfo[room];
            log("map already exist in this room: ", map);
        } else {
            roomsInfo[room] = map;
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
            socket.emit("created", room, map);
        } else if (numClients < maxPlayers) {
            socket.join(room);
            log("Client ID " + socket.id + " joined room " + room);
            io.sockets.in(room).emit("joined", room, map);
        } else {
            socket.emit("full", room);
        }
        log("current rooms:", socket.rooms);
    });

    socket.on("disconnect", function (reason) {
        log("received bye");
    });
});
