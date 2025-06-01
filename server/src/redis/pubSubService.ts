import { pub, sub } from './index';
import { websocketService } from '../services/websocketService';

class PubSubService {
  private isSubscriberInitialized = false;

  // Initialize the subscriber to listen for messages from other servers
  initializeSubscriber(): void {
    if (this.isSubscriberInitialized) return;

    // Listen to all room channels (we'll use pattern matching)
    sub.psubscribe('room:*');
    
    // When we receive a message from Redis
    sub.on('pmessage', (pattern: string, channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        const roomId = channel.replace('room:', ''); // Extract roomId from channel name
        
        // Broadcast this message to our local clients in this room
        websocketService.broadcastToRoom(roomId, data.payload, undefined, true);
      } catch (error) {
        console.error('Error processing pub/sub message:', error);
      }
    });

    this.isSubscriberInitialized = true;
    console.log('Redis subscriber initialized');
  }

  // Send a message to all servers (including this one)
  publishToRoom(roomId: string, message: any): void {
    const channel = `room:${roomId}`;
    const data = {
      payload: message,
      timestamp: Date.now(),
      serverId: process.env.SERVER_ID || 'unknown' // Optional: identify which server sent it
    };
    
    pub.publish(channel, JSON.stringify(data));
  }

  // Clean up when shutting down
  disconnect(): void {
    pub.disconnect();
    sub.disconnect();
  }
}

export const pubSubService = new PubSubService();
