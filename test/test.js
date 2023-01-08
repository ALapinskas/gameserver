const { io } = require("socket.io-client");
const assert = require('assert');

describe("protocol", () => {
    beforeEach(() => {
        player1 = io("http://localhost:9000", { withCredentials: true });
        player2 = io("http://localhost:9000", { withCredentials: true });
        player3 = io("http://localhost:9000", { withCredentials: true });
    });

    afterEach(() => {
        player1 = undefined;
        player2 = undefined;
        player3 = undefined;
    })

    it("player1 send create or join, should receive created event with room name, and map object", (done) => {
        const roomName = "default",
            mapObject = { mapParams: true };
            
        player1.on("created", (room, map) => {
            console.log("created, room: ", room, " map: ", map);
            console.log(player1.id);
            console.log(map.playersInRoom);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player1.close();
        });

        player1.on("joined", (room, map) => {
            console.log("joined, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive joined"));
        });

        player1.on("log", (message) => {
            console.log("log from server ", message);
        });

        player1.on("disconnect", (reason) => {
            console.log("disconnect");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup");
                player1.removeAllListeners("full");
                player1.removeAllListeners("message");
                player1.removeAllListeners("joined");
                player1.removeAllListeners("created");
                player1.removeAllListeners("log");
                player1 = undefined;
                done();
            }
        });

        player1.on("full", (message) => {
            console.log("room is full");
            done(new Error("Shouldn't receive full"));
        });

        player1.on("message", (message) => {
            console.log("message: ", message);
            done(new Error("Shouldn't receive any message"));
        });

        player1.emit("create or join", roomName, mapObject);
    });

    it("player1 creates room, player2 join", (done) => {
        const roomName = "default2",
            mapObject = { mapParams: true };
        
        player1.on("created", (room, map) => {
            console.log("1 created, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
        });

        player1.on("joined", (room, map) => {
            console.log("1 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player1.close();
            player2.close();
        });

        player1.on("log", (message) => {
            console.log("1 log from server ", message);
        });

        player1.on("disconnect", (reason) => {
            console.log("disconnect 1");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 1");
                player1.removeAllListeners("full");
                player1.removeAllListeners("message");
                player1.removeAllListeners("joined");
                player1.removeAllListeners("created");
                player1.removeAllListeners("log");
                player1 = undefined;
            }
        });

        player1.on("full", (message) => {
            console.log("1 room is full");
            done(new Error("Shouldn't receive full"));
        });

        player1.on("message", (message) => {
            console.log("1 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });
        
        player2.on("created", (room, map) => {
            console.log("2 created, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive created"));
        });
        player2.on("joined", (room, map) => {
            console.log("2 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
        });
        player2.on("log", (message) => {
            console.log("2 log from server ", message);
        });
        player2.on("full", (message) => {
            console.log("2 room is full");
            done(new Error("Shouldn't receive full"));
        });
        player2.on("message", (message) => {
            console.log("2 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });

        player2.on("disconnect", (reason) => {
            console.log("disconnect 2");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 2");
                player2.removeAllListeners("full");
                player2.removeAllListeners("message");
                player2.removeAllListeners("joined");
                player2.removeAllListeners("created");
                player2.removeAllListeners("log");
                player2 = undefined;
                done();
            }
        });

        player1.emit("create or join", roomName, mapObject);
        player2.emit("create or join", roomName);
    });

    it("player1 creates room, player2 join, player 2 disconnect, player 1 received a disconnected message", (done) => {
        const roomName = "default4",
            mapObject = { mapParams: true };
        let player2Id;
        
        player1.on("created", (room, map) => {
            console.log("1 created, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player2.emit("create or join", roomName);
        });

        player1.on("joined", (room, map) => {
            console.log("1 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
        });

        player1.on("log", (message) => {
            console.log("1 log from server ", message);
        });

        player1.on("disconnected", (id) => {
            assert.ok(player2Id === id);
            player1.close();
        })

        player1.on("disconnect", (reason) => {
            console.log("disconnect 1");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 1");
                player1.removeAllListeners("full");
                player1.removeAllListeners("message");
                player1.removeAllListeners("joined");
                player1.removeAllListeners("created");
                player1.removeAllListeners("log");
                player1 = undefined;
                done();
            }
        });

        player1.on("full", (message) => {
            console.log("1 room is full");
            done(new Error("Shouldn't receive full"));
        });

        player1.on("message", (message) => {
            console.log("1 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });
        
        player2.on("created", (room, map) => {
            console.log("2 created, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive created"));
        });
        player2.on("joined", (room, map) => {
            console.log("2 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player2Id = player2.id;
            player2.close();
        });
        player2.on("log", (message) => {
            console.log("2 log from server ", message);
        });
        player2.on("full", (message) => {
            console.log("2 room is full");
            done(new Error("Shouldn't receive full"));
        });
        player2.on("message", (message) => {
            console.log("2 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });

        player2.on("disconnect", (reason) => {
            console.log("disconnect 2");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 2");
                player2.removeAllListeners("full");
                player2.removeAllListeners("message");
                player2.removeAllListeners("joined");
                player2.removeAllListeners("created");
                player2.removeAllListeners("log");
                player2 = undefined;
            }
        });

        player1.emit("create or join", roomName, mapObject);
    });

    it("player1 creates room, player2 join, player1 send message, player2 receives it", (done) => {
        const roomName = "default3",
            mapObject = { mapParams: true },
            messageFromPlayer1 = "message from player1";
        
        player1.on("created", (room, map) => {
            console.log("1 created, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player2.emit("create or join", roomName);
        });

        player1.on("joined", (room, map) => {
            console.log("1 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player1.emit("message", messageFromPlayer1);
        });

        player1.on("log", (message) => {
            console.log("1 log from server ", message);
        });

        player1.on("disconnect", (reason) => {
            console.log("disconnect 1");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 1");
                player1.removeAllListeners("full");
                player1.removeAllListeners("message");
                player1.removeAllListeners("joined");
                player1.removeAllListeners("created");
                player1.removeAllListeners("log");
                player1 = undefined;
                player2.close();
            }
        });

        player1.on("full", (message) => {
            console.log("1 room is full");
            done(new Error("Shouldn't receive full"));
        });

        player1.on("message", (message) => {
            console.log("1 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });
        
        player2.on("created", (room, map) => {
            console.log("2 created, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive created"));
        });
        player2.on("joined", (room, map) => {
            console.log("2 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
        });
        player2.on("log", (message) => {
            console.log("2 log from server ", message);
        });
        player2.on("full", (message) => {
            console.log("2 room is full");
            done(new Error("Shouldn't receive full"));
        });
        player2.on("message", (message) => {
            console.log("2 message: ", message);
            assert.ok(messageFromPlayer1);
            player1.close();
        });

        player2.on("disconnect", (reason) => {
            console.log("disconnect 2");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 2");
                player2.removeAllListeners("full");
                player2.removeAllListeners("message");
                player2.removeAllListeners("joined");
                player2.removeAllListeners("created");
                player2.removeAllListeners("log");
                player2 = undefined;
                done();
            }
        });

        player1.emit("create or join", roomName, mapObject);
    });

    it("player1 creates room, player2 join, player3 try to join and receive roomOverflow message", (done) => {
        const roomName = "default4",
            mapObject = { mapParams: true };
        
        player1.on("created", (room, map) => {
            console.log("1 created, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player2.emit("create or join", roomName);
        });

        player1.on("joined", (room, map) => {
            console.log("1 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
        });

        player1.on("log", (message) => {
            console.log("1 log from server ", message);
        });

        player1.on("disconnect", (reason) => {
            console.log("disconnect 1");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 1");
                player1.removeAllListeners("full");
                player1.removeAllListeners("message");
                player1.removeAllListeners("joined");
                player1.removeAllListeners("created");
                player1.removeAllListeners("log");
                player1 = undefined;
                player2.close();
            }
        });

        player1.on("full", (message) => {
            console.log("1 room is full");
            done(new Error("Shouldn't receive full"));
        });

        player1.on("message", (message) => {
            console.log("1 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });
        
        player2.on("created", (room, map) => {
            console.log("2 created, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive created"));
        });
        player2.on("joined", (room, map) => {
            console.log("2 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player3.emit("create or join", roomName);
        });
        player2.on("log", (message) => {
            console.log("2 log from server ", message);
        });
        player2.on("full", (message) => {
            console.log("2 room is full");
            done(new Error("Shouldn't receive full"));
        });
        player2.on("message", (message) => {
            console.log("2 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });

        player2.on("disconnect", (reason) => {
            console.log("disconnect 2");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 2");
                player2.removeAllListeners("full");
                player2.removeAllListeners("message");
                player2.removeAllListeners("joined");
                player2.removeAllListeners("created");
                player2.removeAllListeners("log");
                player2 = undefined;
            }
        });

        player3.on("created", (room, map) => {
            console.log("3 created, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive created"));
        });
        player3.on("joined", (room, map) => {
            console.log("3 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            done(new Error("Shouldn't join for 2 player room"));
        });
        player3.on("log", (message) => {
            console.log("3 log from server ", message);
        });
        player3.on("full", (message) => {
            console.log("3 room is full");
            player1.close();
            player3.close();
            done();

        });
        player3.on("message", (message) => {
            console.log("2 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });

        player3.on("disconnect", (reason) => {
            console.log("disconnect 2");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 2");
                player3.removeAllListeners("full");
                player3.removeAllListeners("message");
                player3.removeAllListeners("joined");
                player3.removeAllListeners("created");
                player3.removeAllListeners("log");
                player3 = undefined;
            }
        });

        player1.emit("create or join", roomName, mapObject);
    });

    it("player1 creates room, player2 join, player1 and player2 are disconnected, player1 sends 'gatherRoomInfo' room created in the first iteration should not be exist", (done) => {
        const roomName = "default5",
            mapObject = { mapParams: true };

        player1.on("created", (room, map) => {
            console.log("1 created, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player2.emit("create or join", roomName);
        });

        player1.on("joined", (room, map) => {
            console.log("1 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
        });

        player1.on("log", (message) => {
            console.log("1 log from server ", message);
        });

        player1.on("disconnect", (reason) => {
            console.log("disconnect 1");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 1");
                player1.removeAllListeners("full");
                player1.removeAllListeners("message");
                player1.removeAllListeners("joined");
                player1.removeAllListeners("created");
                player1.removeAllListeners("log");
                player2.close();
            }
        });

        player1.on("full", (message) => {
            console.log("1 room is full");
            done(new Error("Shouldn't receive full"));
        });

        player1.on("message", (message) => {
            console.log("1 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });
        
        player2.on("created", (room, map) => {
            console.log("2 created, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive created"));
        });
        player2.on("joined", (room, map) => {
            console.log("2 joined, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.ok(map.mapParams === mapObject.mapParams);
            player1.close();
        });
        player2.on("log", (message) => {
            console.log("2 log from server ", message);
        });
        player2.on("full", (message) => {
            console.log("2 room is full");
            done(new Error("Shouldn't receive full"));
        });
        player2.on("message", (message) => {
            console.log("2 message: ", message);
            done(new Error("Shouldn't receive any message"));
        });

        player2.on("disconnect", (reason) => {
            console.log("disconnect 2");
            console.log(reason);
            if(reason === "io client disconnect") {
                console.log("cleanup 2");
                player2.removeAllListeners("full");
                player2.removeAllListeners("message");
                player2.removeAllListeners("joined");
                player2.removeAllListeners("created");
                player2.removeAllListeners("log");
                player2 = undefined;
                setTimeout(() => {
                    player3.emit("gatherRoomsInfo");
                }, 6000);
            }
        });

        player3.on("roomsInfo", (rooms) => {
            console.log("received rooms info: ", rooms);
            if (typeof rooms[roomName] === "undefined") {
                done();
            } else {
                done(new Error("empty rooms should be removed"));
            }
        })
        
        player1.emit("create or join", roomName, mapObject);
    }).timeout(8000);
});
