const isHttps = !!(process.env.CERT && process.env.KEY),
    http = isHttps ? require("https") : require("http"),
    WebSocket = require("ws"),
    fs = require('fs'),
    PORT = process.env.PORT || 9000,
    EMPTY_ROOM_CHECK_TIMER = 5000,
    MAX_LOG_SIZE = 104857600;

let MAX_MESSAGES = 10;

const server = http.createServer(isHttps ? {
    cert: fs.readFileSync(process.env.CERT),
    key: fs.readFileSync(process.env.KEY)
} : {}).listen(PORT);

// Инициализируем WebSocket сервер
const wss = new WebSocket.Server({ server });

const roomsInfo = {};

// Интервал для очистки пустых комнат
setInterval(() => {
    removeEmptyRooms();
}, EMPTY_ROOM_CHECK_TIMER);

// Кастомный генератор ID для клиентов (в socket.io он встроенный)
let clientIdCounter = 0;

wss.on("connection", function (ws) {
    ws.id = "user_" + (++clientIdCounter);
    ws.rooms = new Set(); // Храним комнаты текущего сокета

    async function log(message, sendToClient = false) {
        const arrayLog = [new Date().toISOString(), "id: " + ws.id, message],
            stringLog = arrayLog.join(" | ");
            
        if (sendToClient) {
            sendEvent(ws, "log", arrayLog);
        }
        try {
            let stats, dir = "./logs";
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
                fs.writeFileSync("./logs/logs.txt", stringLog);
            } else {
                try {
                    stats = fs.statSync("./logs/logs.txt");
                    if(stats.isFile() && stats.size > MAX_LOG_SIZE) {
                        fs.writeFileSync("./logs/logs.txt", stringLog);
                    } else if(stats.isFile()) {
                        fs.appendFileSync("./logs/logs.txt", "\n" + stringLog);
                    }
                } catch(e) {
                    fs.writeFileSync("./logs/logs.txt", stringLog);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Хелпер для отправки JSON-событий конкретному клиенту
    function sendEvent(client, event, ...args) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event, args }));
        }
    }

    // Хелпер для отправки события всем в комнате
    function emitToRoom(room, event, ...args) {
        wss.clients.forEach((client) => {
            if (client.rooms.has(room)) {
                sendEvent(client, event, ...args);
            }
        });
    }

    // Хелпер для отправки всем в комнате, КРОМЕ текущего клиента
    function broadcastToRoom(room, event, ...args) {
        wss.clients.forEach((client) => {
            if (client !== ws && client.rooms.has(room)) {
                sendEvent(client, event, ...args);
            }
        });
    }

    // Подсчет клиентов в комнате
    function getNumClientsInRoom(room) {
        let count = 0;
        wss.clients.forEach((client) => {
            if (client.rooms.has(room)) count++;
        });
        return count;
    }

    function messageProcessing(message) {
        ws.rooms.forEach((room) => {
            if (roomsInfo[room] && roomsInfo[room].playersInRoom.includes(ws.id)) {
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
                broadcastToRoom(room, "message", message);
            }
        });
    }

    // Обработка входящих сообщений
    ws.on("message", function (rawData) {
        try {
            const data = JSON.parse(rawData);
            const event = data.event;
            const args = data.args || [];

            if (event === "message") {
                const message = args[0];
                log("Message from client: " + JSON.stringify(message));
                messageProcessing(message);
            }

            if (event === "gatherRoomsInfo") {
                log("gather rooms info received");
                sendEvent(ws, "roomsInfo", roomsInfo);
            }

            if (event === "restart") {
                let state = args[0] || {};
                ws.rooms.forEach((room) => {
                    if (roomsInfo[room] && roomsInfo[room].playersInRoom.includes(ws.id)) {
                        log("Received request to restart the room " + room);
                        state.playersInRoom = roomsInfo[room].playersInRoom;
                        roomsInfo[room] = state;
                        emitToRoom(room, "restarted", state);
                    }
                });
            }

            if (event === "create or join") {
                let room = args[0];
                let state = args[1] || {};
                let maxPlayers = args[2] !== undefined ? args[2] : 2;
                let maxMessages = args[3] !== undefined ? args[3] : 10;

                log("Received request to create or join room " + room);
                
                if (roomsInfo[room]) {
                    state = roomsInfo[room];
                    if (!state.playersInRoom.includes(ws.id)) {
                        state.playersInRoom.push(ws.id);
                    }
                    log("state already exist in this room: ", state);
                } else {
                    MAX_MESSAGES = maxMessages ? maxMessages : MAX_MESSAGES;
                    state.playersInRoom = [ws.id];
                    roomsInfo[room] = state;
                }

                log("client added");
                log(JSON.stringify(roomsInfo));
                
                const numClients = getNumClientsInRoom(room);
                log("Room " + room + " now has " + numClients + " client(s)");

                if (numClients === 0) {
                    ws.rooms.add(room);
                    log("Client ID " + ws.id + " created room " + room);
                    sendEvent(ws, "created", room, state);
                } else if (numClients < maxPlayers) {
                    ws.rooms.add(room);
                    log("Client ID " + ws.id + " joined room " + room);
                    emitToRoom(room, "joined", room, state);
                } else {
                    sendEvent(ws, "full", room);
                }
                log("current rooms: " + JSON.stringify(Array.from(ws.rooms)));
            }

        } catch (err) {
            console.error("Error parsing message: ", err);
        }
    });

    ws.on("close", function () {
        log("received bye");
        Object.keys(roomsInfo).forEach((room) => {
            if (roomsInfo[room] && roomsInfo[room].playersInRoom) {
                let deletedSocketIndex = roomsInfo[room].playersInRoom.indexOf(ws.id);
                if(deletedSocketIndex !== -1) {
                    roomsInfo[room].playersInRoom.splice(deletedSocketIndex, 1);
                    emitToRoom(room, "disconnected", ws.id);
                }
            }
        });
    });
});

function removeEmptyRooms() {
    Object.keys(roomsInfo).forEach((roomKey) => {
        if (!roomsInfo[roomKey].playersInRoom || roomsInfo[roomKey].playersInRoom.length === 0) {
            delete roomsInfo[roomKey];
        }
    });
}
