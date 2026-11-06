import { Kafka, Partitioners } from 'kafkajs';
import { config } from '../config';
import { pub, sub } from '../redis';
import { KafkaWriter, DbAck, DbOperation, DB_ACK_CHANNEL, DB_OPS_TOPIC, applyDbOperation } from './kafkaWriter';

// Connects the producer, consumer and ack relay, and returns a writer that routes
// session writes through Kafka. Only loaded when ENABLE_KAFKA=true.
export async function startKafka() {
  const kafka = new Kafka({ clientId: 'interactify-server', brokers: config.kafkaBrokers });

  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: [{ topic: DB_OPS_TOPIC, numPartitions: 3, replicationFactor: 1 }],
    });
  } finally {
    await admin.disconnect();
  }

  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();

  const writer = new KafkaWriter(async (op: DbOperation) => {
    await producer.send({
      topic: DB_OPS_TOPIC,
      messages: [{ key: op.key, value: JSON.stringify(op) }],
    });
  });

  await sub.subscribe(DB_ACK_CHANNEL);
  sub.on('message', (channel: string, message: string) => {
    if (channel !== DB_ACK_CHANNEL) return;
    try {
      writer.handleAck(JSON.parse(message) as DbAck);
    } catch (error) {
      console.error('Invalid DB ack message:', error);
    }
  });

  const consumer = kafka.consumer({ groupId: 'db-operations-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: DB_OPS_TOPIC, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      let op: DbOperation;
      try {
        op = JSON.parse(message.value?.toString() || '');
      } catch (error) {
        console.error('Skipping malformed DB operation:', error);
        return;
      }

      const ack = await applyDbOperation(op);
      if (!ack.ok) {
        console.error(`DB operation ${op.type} failed:`, ack.error?.message);
      }
      await pub.publish(DB_ACK_CHANNEL, JSON.stringify(ack));
    },
  });

  console.log('Kafka producer and consumer connected');

  return {
    writer,
    async stop() {
      writer.rejectAll(new Error('Server shutting down'));
      await consumer.disconnect();
      await producer.disconnect();
    },
  };
}
