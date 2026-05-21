const assert = require('assert');

describe("protocol", () => {
    beforeEach(() => {
        player1 = new WebSocket("ws://localhost:9000");
        player2 = new WebSocket("ws://localhost:9000");
        player3 = new WebSocket("ws://localhost:9000");
    });

    afterEach(() => {
        if (player1 && player1.readyState === WebSocket.OPEN) player1.close();
        if (player2 && player2.readyState === WebSocket.OPEN) player2.close();
        if (player3 && player3.readyState === WebSocket.OPEN) player3.close();
        player1 = undefined;
        player2 = undefined;
        player3 = undefined;
    });

    it("player1 send create or join, should receive created event with room name, and map object", (done) => {
        const roomName = "default",
            mapObject = { mapParams: true };
            
        // Прием и разбор сообщений от сервера
        player1.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                const [room, map] = args;
                console.log("created, room: ", room, " map: ", map);
                console.log(map.playersInRoom); // На сервере у нас массив ID
                
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Инициируем закрытие сокета (это вызовет player1.onclose)
                player1.close();
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("joined, room: ", room, " map: ", map);
                done(new Error("Shouldn't receive joined"));
            }

            if (data.event === "log") {
                console.log("log from server ", args);
            }

            if (data.event === "full") {
                console.log("room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Замена события "disconnect". Срабатывает после вызова player1.close()
        player1.onclose = function() {
            console.log("disconnect");
            console.log("cleanup");
            // На нативных сокетах нам больше не нужно вручную вызывать removeAllListeners,
            // а зануление переменной player1 сделает хук afterEach.
            done();
        };

        // Отправка запроса строго после того, как соединение установится
        player1.onopen = function() {
            player1.send(JSON.stringify({
                event: "create or join",
                args: [roomName, mapObject]
            }));
        };
    });

    it("player1 creates room, player2 join", (done) => {
        const roomName = "default2",
            mapObject = { mapParams: true };
        
        // Логика первого игрока (Создатель)
        player1.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                const [room, map] = args;
                console.log("1 created, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("1 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Закрываем оба соединения
                player1.close();
                player2.close();
            }

            if (data.event === "log") {
                console.log("1 log from server ", args);
            }

            if (data.event === "full") {
                console.log("1 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("1 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика второго игрока (Присоединившийся)
        player2.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                done(new Error("Shouldn't receive created"));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("2 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
            }

            if (data.event === "log") {
                console.log("2 log from server ", args);
            }

            if (data.event === "full") {
                console.log("2 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("2 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Счетчик для безопасного закрытия обоих сокетов
        let disconnectedCount = 0;
        const checkDone = () => {
            disconnectedCount++;
            if (disconnectedCount === 2) {
                console.log("cleanup 1 & 2");
                done();
            }
        };

        player1.onclose = checkDone;
        player2.onclose = checkDone;

        // Синхронизация открытия: ждем готовности обоих сокетов
        let openCount = 0;
        const startTest = () => {
            openCount++;
            if (openCount === 2) {
                player1.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName, mapObject]
                }));
                player2.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName]
                }));
            }
        };

        player1.onopen = startTest;
        player2.onopen = startTest;
    });

    it("player1 creates room, player2 join, player 2 disconnect, player 1 received a disconnected message", (done) => {
        const roomName = "default4",
            mapObject = { mapParams: true };
        let player2Id;
        
        // Логика первого игрока (Создатель)
        player1.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                const [room, map] = args;
                console.log("1 created, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Отправляем запрос от второго игрока только после создания комнаты
                player2.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName]
                }));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("1 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
            }

            if (data.event === "log") {
                console.log("1 log from server ", args);
            }

            if (data.event === "disconnected") {
                const [id] = args;
                // Сверяем ID отключившегося игрока с сохраненным ID игрока 2
                assert.strictEqual(id, player2Id);
                player1.close();
            }

            if (data.event === "full") {
                console.log("1 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("1 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика второго игрока (Присоединившийся)
        player2.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                done(new Error("Shouldn't receive created"));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("2 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Так как игрок 2 вошел последним, его ID находится в конце массива
                player2Id = map.playersInRoom[map.playersInRoom.length - 1];
                player2.close();
            }

            if (data.event === "log") {
                console.log("2 log from server ", args);
            }

            if (data.event === "full") {
                console.log("2 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("2 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Тест успешно завершается только тогда, когда создатель (player1) закроет сокет
        player1.onclose = function() {
            console.log("disconnect 1");
            console.log("cleanup 1");
            done();
        };

        player2.onclose = function() {
            console.log("disconnect 2");
            console.log("cleanup 2");
        };

        // Запуск теста. Дожидаемся открытия обоих сокетов перед началом взаимодействия
        let openCount = 0;
        const startTest = () => {
            openCount++;
            if (openCount === 2) {
                player1.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName, mapObject]
                }));
            }
        };

        player1.onopen = startTest;
        player2.onopen = startTest;
    });

    it("player1 creates room, player2 join, player1 send message, player2 receives it", (done) => {
        const roomName = "default3",
            mapObject = { mapParams: true },
            messageFromPlayer1 = "message from player1";
        
        // Логика первого игрока (Отправитель)
        player1.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                const [room, map] = args;
                console.log("1 created, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Заводим второго игрока после создания комнаты
                player2.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName]
                }));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("1 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Игрок 1 отправляет сообщение в комнату
                player1.send(JSON.stringify({
                    event: "message",
                    args: [messageFromPlayer1]
                }));
            }

            if (data.event === "log") {
                console.log("1 log from server ", args);
            }

            if (data.event === "full") {
                console.log("1 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("1 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика второго игрока (Получатель)
        player2.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                done(new Error("Shouldn't receive created"));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("2 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
            }

            if (data.event === "log") {
                console.log("2 log from server ", args);
            }

            if (data.event === "full") {
                console.log("2 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                const [message] = args;
                console.log("2 message: ", message);
                
                // Проверяем, что пришло именно то сообщение
                assert.strictEqual(message, messageFromPlayer1);
                
                // Запускаем цепочку закрытия сокетов
                player1.close();
            }
        };

        // На созвоне закрытия сокетов: player1 закрывается -> закрывает player2 -> завершаем тест
        player1.onclose = function() {
            console.log("disconnect 1");
            console.log("cleanup 1");
            player2.close();
        };

        player2.onclose = function() {
            console.log("disconnect 2");
            console.log("cleanup 2");
            done();
        };

        // Инициализация теста: дожидаемся готовности соединений
        let openCount = 0;
        const startTest = () => {
            openCount++;
            if (openCount === 2) {
                player1.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName, mapObject]
                }));
            }
        };

        player1.onopen = startTest;
        player2.onopen = startTest;
    });

    it("player1 creates room, player2 join, player3 try to join and receive roomOverflow message", (done) => {
        const roomName = "default4",
            mapObject = { mapParams: true };
        
        // Логика первого игрока (Создатель)
        player1.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                const [room, map] = args;
                console.log("1 created, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Подключаем игрока 2 после создания комнаты
                player2.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName]
                }));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("1 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
            }

            if (data.event === "log") {
                console.log("1 log from server ", args);
            }

            if (data.event === "full") {
                console.log("1 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("1 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика второго игрока
        player2.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                done(new Error("Shouldn't receive created"));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("2 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Подключаем игрока 3 только после того, как игрок 2 успешно вошел
                player3.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName]
                }));
            }

            if (data.event === "log") {
                console.log("2 log from server ", args);
            }

            if (data.event === "full") {
                console.log("2 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("2 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика третьего игрока (Лишний)
        player3.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                console.log("3 created, room: ", args);
                done(new Error("Shouldn't receive created"));
            }

            if (data.event === "joined") {
                console.log("3 joined, room: ", args);
                done(new Error("Shouldn't join for 2 player room"));
            }

            if (data.event === "log") {
                console.log("3 log from server ", args);
            }

            if (data.event === "full") {
                const [room] = args;
                console.log("3 room is full: ", room);
                
                // Успешный исход теста: комната заполнена, закрываем соединения
                player1.close();
                player3.close();
            }

            if (data.event === "message") {
                console.log("3 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика отслеживания закрытия сокетов
        player1.onclose = function() {
            console.log("disconnect 1");
            player2.close(); // Закрываем оставшегося игрока 2
        };

        player2.onclose = function() {
            console.log("disconnect 2");
        };

        player3.onclose = function() {
            console.log("disconnect 3");
            // Тест полностью завершается, когда player3 подтвердит закрытие своего сокета
            done();
        };

        // Инициализация теста: дожидаемся открытия всех трех сокетов перед отправкой
        let openCount = 0;
        const startTest = () => {
            openCount++;
            if (openCount === 3) {
                player1.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName, mapObject]
                }));
            }
        };

        player1.onopen = startTest;
        player2.onopen = startTest;
        player3.onopen = startTest;
    });

    it("player1 creates room, player2 join, player1 and player2 are disconnected, player1 sends 'gatherRoomInfo' room created in the first iteration should not be exist", function(done) {
        // Увеличиваем таймаут Mocha для этого теста, так как ждем очистки по таймеру
        this.timeout(8000);

        const roomName = "default5",
            mapObject = { mapParams: true };

        // Логика первого игрока (Создатель)
        player1.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                const [room, map] = args;
                console.log("1 created, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Подключаем игрока 2 после создания комнаты
                player2.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName]
                }));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("1 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
            }

            if (data.event === "log") {
                console.log("1 log from server ", args);
            }

            if (data.event === "full") {
                console.log("1 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("1 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика второго игрока
        player2.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "created") {
                done(new Error("Shouldn't receive created"));
            }

            if (data.event === "joined") {
                const [room, map] = args;
                console.log("2 joined, room: ", room, " map: ", map);
                assert.ok(room === roomName);
                assert.ok(map.mapParams === mapObject.mapParams);
                
                // Как только игрок 2 зашел, запускаем цепочку отключений: закрываем игрока 1
                player1.close();
            }

            if (data.event === "log") {
                console.log("2 log from server ", args);
            }

            if (data.event === "full") {
                console.log("2 room is full");
                done(new Error("Shouldn't receive full"));
            }

            if (data.event === "message") {
                console.log("2 message: ", args);
                done(new Error("Shouldn't receive any message"));
            }
        };

        // Логика третьего игрока (Проверяющий состояние комнат)
        player3.onmessage = function(event) {
            const data = JSON.parse(event.data);
            const args = data.args || [];

            if (data.event === "roomsInfo") {
                const [rooms] = args;
                console.log("received rooms info: ", rooms);
                
                // Успешный исход теста: комната должна удалиться из списка на сервере
                if (typeof rooms[roomName] === "undefined") {
                    done();
                } else {
                    done(new Error("empty rooms should be removed"));
                }
            }
        };

        // Цепочка обработки закрытия сокетов
        player1.onclose = function() {
            console.log("disconnect 1");
            console.log("cleanup 1");
            player2.close(); // Закрываем игрока 2 вслед за игроком 1
        };

        player2.onclose = function() {
            console.log("disconnect 2");
            console.log("cleanup 2");
            
            // Комната полностью опустела. Ждем 6 секунд, пока на сервере 
            // сработает setInterval(() => removeEmptyRooms(), 5000)
            setTimeout(() => {
                player3.send(JSON.stringify({
                    event: "gatherRoomsInfo",
                    args: []
                }));
            }, 6000);
        };

        // Инициализация теста: дожидаемся готовности всех трех сокетов
        let openCount = 0;
        const startTest = () => {
            openCount++;
            if (openCount === 3) {
                player1.send(JSON.stringify({
                    event: "create or join",
                    args: [roomName, mapObject]
                }));
            }
        };

        player1.onopen = startTest;
        player2.onopen = startTest;
        player3.onopen = startTest;
    });
});
