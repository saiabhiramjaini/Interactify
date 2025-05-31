"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const websocketService_1 = require("./services/websocketService");
const messageHandlers_1 = require("./handlers/messageHandlers");
const wss = new ws_1.WebSocketServer({ port: 8080 });
wss.on("connection", (socket) => {
    websocketService_1.websocketService.addClient(socket);
    socket.on("error", (error) => {
        console.error("WebSocket error:", error);
    });
    socket.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            switch (parsedMessage.type) {
                case "create":
                    (0, messageHandlers_1.handleCreateSession)(socket, parsedMessage.payload);
                    break;
                case "join":
                    (0, messageHandlers_1.handleJoinSession)(socket, parsedMessage.payload);
                    break;
                case "getSession":
                    (0, messageHandlers_1.handleGetSession)(socket, parsedMessage.payload);
                    break;
                case "question":
                    (0, messageHandlers_1.handleQuestion)(socket, parsedMessage.payload);
                    break;
                case "vote":
                    (0, messageHandlers_1.handleVote)(socket, parsedMessage.payload);
                    break;
                case "markQuestion":
                    (0, messageHandlers_1.handleMarkQuestion)(socket, parsedMessage.payload);
                    break;
                case "leave":
                    (0, messageHandlers_1.handleLeaveSession)(socket, parsedMessage.payload);
                    break;
                case "close":
                    (0, messageHandlers_1.handleCloseSession)(socket, parsedMessage.payload);
                    break;
                default:
                    console.error("Unknown message type:", parsedMessage.type);
                    websocketService_1.websocketService.sendToClient(socket, {
                        type: "error",
                        payload: { message: "Unknown message type" },
                    });
            }
        }
        catch (error) {
            console.error("Error parsing message:", error);
            websocketService_1.websocketService.sendToClient(socket, {
                type: "error",
                payload: { message: "Invalid message format" },
            });
        }
    });
    socket.on("close", () => {
        const client = websocketService_1.websocketService.removeClient(socket);
        if (client && client.roomId && client.attendee) {
            // Handle cleanup when client disconnects
            const { sessionService } = require('./services/sessionService');
            const session = sessionService.leaveSession(client.roomId, client.attendee);
            if (session) {
                websocketService_1.websocketService.broadcastToRoom(client.roomId, {
                    type: "attendeeLeft",
                    payload: { attendee: client.attendee, attendees: session.attendees },
                });
            }
        }
    });
});
console.log("WebSocket server is running on ws://localhost:8080");
