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
            assert.ok(room === roomName);
            assert.deepEqual(map, mapObject);
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
        const roomName = "default",
            mapObject = { mapParams: true };
        
        player1.on("created", (room, map) => {
            console.log("1 created, room: ", room, " map: ", map);
            assert.ok(room === roomName);
            assert.deepEqual(map, mapObject);
        });

        player1.on("joined", (room, map) => {
            console.log("1 joined, room: ", room, " map: ", map);
            done(new Error("Shouldn't receive joined"));
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
            assert.deepEqual(map, mapObject);
            player1.close();
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
                done();
            }
        });

        player1.emit("create or join", roomName, mapObject);
        player2.emit("create or join", roomName);
    });
});
