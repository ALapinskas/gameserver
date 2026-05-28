import https from 'node:https';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs';

const isHttps = !!(process.env.CERT && process.env.KEY);
const PORT = process.env.PORT || 9000;
const EMPTY_ROOM_CHECK_TIMER = 5000;
const MAX_LOG_SIZE = 104_857_600;

let MAX_MESSAGES = 10;

const serverOptions = isHttps ? {
    cert: fs.readFileSync(process.env.CERT),
    key: fs.readFileSync(process.env.KEY)
} : {};

const server = (isHttps ? https : http)
    .createServer(serverOptions)
    .listen(PORT, () => console.log(`Server running on port ${PORT}`));

const wss = new WebSocketServer({ server });

/**
 * @typedef {Object} RoomState
 * @property {string[]} playersInRoom - ID игроков в комнате
 * @property {Map<string, Object>} playersInfo - Карта информации об игроках (ID -> userInfo)
 * @property {any[]} [messages] - История сообщений
 */

/**
 * @typedef {{ [roomName: string]: RoomState }} RoomsInfo
 */

/** @type {RoomsInfo} */
const roomsInfo = {};

/**
 * Расширенный тип для WebSocket сокета
 * @typedef {import('ws').WebSocket & { id: string, rooms: Set<string> }} ExtWebSocket
 */

// Хелпер для сериализации объектов, содержащих Map (для JSON.stringify)
const replacer = (key, value) => {
    if (value instanceof Map) {
        return Object.fromEntries(value); // Конвертирует Map в обычный объект {} для JSON
    }
    return value;
};

const removeEmptyRooms = () => {
    Object.keys(roomsInfo).forEach((roomKey) => {
        if (!roomsInfo[roomKey].playersInRoom || roomsInfo[roomKey].playersInRoom.length === 0) {
            delete roomsInfo[roomKey];
        }
    });
};

setInterval(removeEmptyRooms, EMPTY_ROOM_CHECK_TIMER);

let clientIdCounter = 0;

wss.on("connection", /** @param {ExtWebSocket} ws */ (ws) => {
    clientIdCounter += 1;
    ws.id = `user_${clientIdCounter}`;
    ws.rooms = new Set();

    /**
     * Асинхронное логирование событий с поддержкой сериализации Map
     */
    const log = async (message, sendToClient = false) => {
        // Если передали объект (например, roomsInfo), сериализуем его с учетом Map
        const formattedMessage = typeof message === 'object' ? JSON.stringify(message, replacer) : message;
        const arrayLog = [new Date().toISOString(), `id: ${ws.id}`, formattedMessage];
        const stringLog = arrayLog.join(" | ");
            
        if (sendToClient) {
            sendEvent(ws, "log", arrayLog);
        }
        try {
            const dir = "./logs";
            const logFile = `${dir}/logs.txt`;

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
                fs.writeFileSync(logFile, stringLog);
            } else {
                try {
                    const stats = fs.statSync(logFile);
                    if (stats.isFile() && stats.size > MAX_LOG_SIZE) {
                        fs.writeFileSync(logFile, stringLog);
                    } else if (stats.isFile()) {
                        fs.appendFileSync(logFile, `\n${stringLog}`);
                    }
                } catch {
                    fs.writeFileSync(logFile, stringLog);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * Хелпер отправки событий. Преобразует Map в обычные объекты для клиента.
     */
    const sendEvent = (client, event, ...args) => {
        if (client.readyState === 1) {
            // Преобразуем все Map структуры в обычные объекты перед отправкой по сети
            const safeArgs = JSON.parse(JSON.stringify(args, replacer));
            client.send(JSON.stringify({ event, args: safeArgs }));
        }
    };

    const emitToRoom = (room, event, ...args) => {
        wss.clients.forEach((/** @type {ExtWebSocket} */ client) => {
            if (client.rooms?.has(room)) {
                sendEvent(client, event, ...args);
            }
        });
    };

    const broadcastToRoom = (room, event, ...args) => {
        wss.clients.forEach((/** @type {ExtWebSocket} */ client) => {
            if (client !== ws && client.rooms?.has(room)) {
                sendEvent(client, event, ...args);
            }
        });
    };

    const getNumClientsInRoom = (room) => {
        let count = 0;
        wss.clients.forEach((/** @type {ExtWebSocket} */ client) => {
            if (client.rooms?.has(room)) count++;
        });
        return count;
    };

    const messageProcessing = (message) => {
        ws.rooms.forEach((room) => {
            const currentRoom = roomsInfo[room];
            if (currentRoom && currentRoom.playersInRoom.includes(ws.id)) {
                if (!currentRoom.messages) {
                    currentRoom.messages = [message];
                } else if (currentRoom.messages.length < MAX_MESSAGES) {
                    currentRoom.messages.push(message);
                } else {
                    currentRoom.messages.shift();
                    currentRoom.messages.push(message);
                }
                log("updated info:");
                log(roomsInfo);
                broadcastToRoom(room, "message", message);
            }
        });
    };

    ws.on("message", (rawData) => {
        try {
            const { event, args = [] } = JSON.parse(rawData.toString());

            if (event === "message") {
                const message = args[0];
                log(`Message from client: ${JSON.stringify(message)}`);
                messageProcessing(message);
            }

            if (event === "gatherRoomsInfo") {
                log("gather rooms info received");
                sendEvent(ws, "roomsInfo", Object.keys(roomsInfo));
            }

            if (event === "restart") {
                const [userInfo = {}] = args;
                ws.rooms.forEach((room) => {
                    const currentRoom = roomsInfo[room];
                    if (currentRoom && currentRoom.playersInRoom.includes(ws.id)) {
                        log(`Received request to restart the room ${room}`);
                        
                        // Обновляем данные конкретного игрока в Map при перезапуске
                        currentRoom.playersInfo.set(ws.id, userInfo);
                        
                        emitToRoom(room, "restarted", currentRoom);
                    }
                });
            }

            if (event === "create or join") {
                const [room, userInfo = {}, maxPlayers = 2, maxMessages = 10] = args;

                log(`Received request to create or join room ${room}`);
                
                if (roomsInfo[room]) {
                    // Если комната существует, добавляем игрока в списки
                    const currentRoom = roomsInfo[room];
                    if (!currentRoom.playersInRoom.includes(ws.id)) {
                        currentRoom.playersInRoom.push(ws.id);
                    }
                    // Сохраняем/обновляем параметры userInfo внутри Map
                    currentRoom.playersInfo.set(ws.id, userInfo);
                    log("room already exists, user added to playersInfo Map");
                } else {
                    // Если комнаты нет, инициализируем RoomState с новым Map
                    MAX_MESSAGES = maxMessages ? maxMessages : MAX_MESSAGES;
                    
                    roomsInfo[room] = {
                        playersInRoom: [ws.id],
                        playersInfo: new Map([[ws.id, userInfo]]), // Инициализируем Map сразу с текущим игроком
                        messages: []
                    };
                }

                log("client added");
                log(roomsInfo);
                
                const numClients = getNumClientsInRoom(room);
                log(`Room ${room} now has ${numClients} client(s)`);

                if (numClients === 0) {
                    ws.rooms.add(room);
                    log(`Client ID ${ws.id} created room ${room}`);
                    sendEvent(ws, "created", room, roomsInfo[room]);
                } else if (numClients < maxPlayers) {
                    ws.rooms.add(room);
                    log(`Client ID ${ws.id} joined room ${room}`);
                    emitToRoom(room, "joined", room, roomsInfo[room]);
                } else {
                    sendEvent(ws, "full", room);
                }
                log(`current rooms: ${JSON.stringify(Array.from(ws.rooms))}`);
            }

        } catch (err) {
            console.error("Error parsing message: ", err);
        }
    });

    ws.on("close", () => {
        log("received bye");
        Object.keys(roomsInfo).forEach((room) => {
            const currentRoom = roomsInfo[room];
            if (currentRoom && currentRoom.playersInRoom) {
                const deletedSocketIndex = currentRoom.playersInRoom.indexOf(ws.id);
                if (deletedSocketIndex !== -1) {
                    currentRoom.playersInRoom.splice(deletedSocketIndex, 1);
                    currentRoom.playersInfo.delete(ws.id); // Удаляем данные игрока из Map при отключении
                    emitToRoom(room, "disconnected", ws.id);
                }
            }
        });
    });
});
