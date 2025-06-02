import { Kafka, Partitioners } from "kafkajs";
import { kafka } from "./client";

export class KafkaProducer {
  private producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner
  });

  async connect() {
    await this.producer.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
  }

  async sendDbOperation(operation: {
    type: 'create' | 'update' | 'delete';
    collection: string;
    data: any;
    query?: any;
  }) {
    try {
      // Format the data for better readability
      const formattedData = JSON.stringify(operation.data, null, 2);
      const formattedQuery = operation.query ? JSON.stringify(operation.query, null, 2) : '{}';

      console.log('\n📤 Database Operation:', {
        operation: operation.type,
        collection: operation.collection,
        query: formattedQuery,
        data: formattedData
      });

      await this.producer.send({
        topic: 'db-operations',
        messages: [
          {
            value: JSON.stringify(operation),
          },
        ],
      });

    } catch (error) {
      console.error('❌ Database Operation Failed:', error);
      throw error;
    }
  }
}

export const kafkaProducer = new KafkaProducer();