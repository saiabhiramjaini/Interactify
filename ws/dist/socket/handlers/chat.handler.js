"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registerChatHandlers = (io, socket) => {
    socket.on("message", (msg) => {
        console.log("Received chat message:", msg);
        io.emit("message", msg);
    });
};
exports.default = registerChatHandlers;
