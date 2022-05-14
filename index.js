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
    async function clientLog(message) {
        const arrayLog = [new Date(), socket.id, "Message from server: ", message],
            stringLog = arrayLog.join(" | ");
        console.log(stringLog);
        socket.emit("log", stringLog);
        try {
            const stats = await fs.statSync("./logs/logs.txt");
            if(stats.isFile() && stats.size > 1024000) {//10 MB
                fs.writeFile("./logs/logs.txt", stringLog, err => {
                    console.error(err);
                });
            } else if(stats.isFile()) {
                fs.writeFile("./logs/logs.txt", "\n" + stringLog, { flag: 'a+' }, err => {
                    console.error(err);
                });
            }
        } catch (err) {
            if(err.code === 'ENOENT') {
                fs.writeFile("./logs/logs.txt", stringLog, err => {
                    console.error(err);
                });
            } else {
                console.log(err);
            }
        }
    }

    function messageProcessing(message) {
        //console.log("message processing ", message);
        //console.log(socket);
        if (socket.disconnected === true) {
            //console.log("remove rooms info for id: ", socket.id);
            //console.log(socket.adapter.rooms);
            socket.adapter.rooms.forEach((roomInfo, room) => {
                //console.log("room: ", room);
                //console.log(roomsInfo);
                if (roomsInfo[room]) {
                    console.log(
                        "disconnect message processing, broadcast to ",
                        socket.id
                    );
                    socket.broadcast
                        .to(room)
                        .emit("removed", roomsInfo[room][socket.id]);
                    socket.leave(room);
                    delete roomsInfo[room][socket.id];
                    console.log("disconnected");
                    console.log(roomsInfo[room]);
                }
            });
        }
        socket.rooms.forEach((room) => {
            console.log("room: ", room);
            if (roomsInfo[room] && message === "disconnect") {
                console.log(
                    "disconnect message processing, broadcast to ",
                    socket.id
                );
                socket.broadcast
                    .to(room)
                    .emit("removed", roomsInfo[room][socket.id]);
                socket.leave(room);
                delete roomsInfo[room][socket.id];
                console.log("disconnected");
                console.log(roomsInfo[room]);
            } else if (roomsInfo[room] && isCurrentSocketInRoom(room)) {
                roomsInfo[room][socket.id] = message;
                console.log("updated info:");
                console.log(roomsInfo);
                socket.broadcast.to(room).emit("message", message);
            }
        });
    }

    function isCurrentSocketInRoom(room) {
        return Object.prototype.hasOwnProperty.call(roomsInfo[room], socket.id);
    }

    

    socket.on("message", function (message) {
        clientLog("Client said: ", message);
        //broadcast only for belong rooms
        messageProcessing(message);
    });

    socket.on("gatherRoomsInfo", () => {
        console.log("gather rooms info received");
        socket.emit("roomsInfo", roomsInfo);
    });

    socket.on("create or join", function (room, map, maxPlayers = 2) {
        clientLog("Received request to create or join room " + room);
        if (roomsInfo[room]) {
            //@todo: rebuild this stuff
            Object.keys(roomsInfo[room]).forEach((joined_id) => {
                if (socket.id !== joined_id) {
                    console.log("sent message, with current info");
                    console.log(roomsInfo[room][joined_id]);
                    io.to(socket.id).emit(
                        "message",
                        roomsInfo[room][joined_id]
                    );
                }
            });

            map = roomsInfo[room].map;
            console.log("map: ", map);
        } else {
            roomsInfo[room] = { map };
        }
        roomsInfo[room][socket.id] = {};
        ///////////
        console.log("client added");
        console.log(roomsInfo);
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        clientLog("Room " + room + " now has " + numClients + " client(s)");

        if (numClients === 0) {
            socket.join(room);
            clientLog("Client ID " + socket.id + " created room " + room);
            socket.emit("created", room, map);
        } else if (numClients < maxPlayers) {
            socket.join(room);
            clientLog("Client ID " + socket.id + " joined room " + room);
            socket.emit("joined", room, map);
            io.sockets.in(room).emit("joined");
        } else {
            // max two clients
            socket.emit("full", room);
        }
    });

    socket.on("disconnect", function (reason) {
        clientLog("received bye");
    });
});
