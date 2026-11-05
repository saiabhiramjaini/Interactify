import { pub, sub } from './index';
import { config } from '../config';
import { websocketService } from '../ws/services/websocketService';

const ROOM_CHANNEL_PREFIX = 'room:';

interface RoomEnvelope {
  payload: any;
  timestamp: number;
  serverId: string;
  instanceId: string;
}

class PubSubService {
  private isSubscriberInitialized = false;

  // Listen for room messages published by other server instances
  async initializeSubscriber(): Promise<void> {
    if (this.isSubscriberInitialized) return;

    await sub.psubscribe(`${ROOM_CHANNEL_PREFIX}*`);
    sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
      this.handleRoomMessage(channel, message);
    });

    this.isSubscriberInitialized = true;
    console.log('Redis subscriber initialized');
  }

  handleRoomMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message) as RoomEnvelope;

      // This instance already delivered the message to its own clients before
      // publishing it, so delivering it again would duplicate it.
      if (data.instanceId === config.instanceId) return;

      const roomId = channel.slice(ROOM_CHANNEL_PREFIX.length);
      websocketService.deliverToRoom(roomId, data.payload);

      if (data.payload?.type === 'sessionClosed') {
        websocketService.clearClientsFromRoom(roomId);
      }
    } catch (error) {
      console.error('Error processing pub/sub message:', error);
    }
  }

  // Share a room message with the other server instances
  publishToRoom(roomId: string, message: any): void {
    const data: RoomEnvelope = {
      payload: message,
      timestamp: Date.now(),
      serverId: config.serverId,
      instanceId: config.instanceId,
    };

    pub.publish(`${ROOM_CHANNEL_PREFIX}${roomId}`, JSON.stringify(data)).catch((error) => {
      console.error('Error publishing to Redis:', error);
    });
  }

  disconnect(): void {
    pub.disconnect();
    sub.disconnect();
  }
}

export const pubSubService = new PubSubService();
