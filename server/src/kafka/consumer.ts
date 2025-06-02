import { kafka } from "./client";
import { SessionModel } from "../db/models/sessionModel";

export class KafkaConsumer {
  private consumer = kafka.consumer({ groupId: "db-operations-group" });

  async connect() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "db-operations", fromBeginning: true });
  }

  async disconnect() {
    await this.consumer.disconnect();
  }

  async start() {
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const operation = JSON.parse(message.value?.toString() || "{}");
          
          switch (operation.collection) {
            case "sessions":
              await this.handleSessionOperation(operation);
              break;
            default:
              console.error("Unknown collection:", operation.collection);
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      },
    });
  }

  private async handleSessionOperation(operation: any) {
    try {
      // Format the data for better readability
      const formattedData = JSON.stringify(operation.data, null, 2);
      const formattedQuery = operation.query ? JSON.stringify(operation.query, null, 2) : '{}';

      switch (operation.type) {
        case "create":
          const createdSession = await SessionModel.create(operation.data);
          console.log('\n📥 Database: Created Session', {
            sessionId: createdSession._id,
            roomId: createdSession.roomId,
            owner: createdSession.owner,
            data: formattedData
          });
          break;

        case "update":
          const updateResult = await SessionModel.updateOne(operation.query, operation.data);
          console.log('\n📥 Database: Updated Session', {
            query: formattedQuery,
            update: formattedData,
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount
          });
          break;

        case "delete":
          const deleteResult = await SessionModel.deleteOne(operation.query);
          console.log('\n📥 Database: Deleted Session', {
            query: formattedQuery,
            deleted: deleteResult.deletedCount
          });
          break;

        default:
          console.error("Unknown operation type:", operation.type);
      }
    } catch (error) {
      console.error('Database Operation Failed:', error);
      throw error;
    }
  }
}

export const kafkaConsumer = new KafkaConsumer();