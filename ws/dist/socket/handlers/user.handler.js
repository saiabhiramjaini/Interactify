"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registerUserHandlers = (io, socket) => {
    socket.on("join", (username) => {
        console.log(`${username} joined`);
        socket.broadcast.emit("userJoined", username);
    });
};
exports.default = registerUserHandlers;
