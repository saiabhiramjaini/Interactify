"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocket = void 0;
const chat_handler_1 = __importDefault(require("./handlers/chat.handler"));
const user_handler_1 = __importDefault(require("./handlers/user.handler"));
const setupSocket = (io) => {
    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);
        // Register all feature handlers
        (0, user_handler_1.default)(io, socket);
        (0, chat_handler_1.default)(io, socket);
        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
};
exports.setupSocket = setupSocket;
