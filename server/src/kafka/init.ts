import { kafka } from "./client";

export async function initializeKafka() {
  const admin = kafka.admin();
  console.log("Connecting to Kafka...");
  await admin.connect();
  console.log("Connected to Kafka");

  try {
    await admin.createTopics({
      topics: [
        { 
          topic: "db-operations", 
          numPartitions: 3, // Using 3 partitions for better scalability
          replicationFactor: 1 // Using 1 since this is a basic setup
        },
      ],
    });
    console.log("Kafka topics created successfully");
  } catch (error) {
    console.error("Error creating Kafka topics:", error);
    throw error;
  } finally {
    await admin.disconnect();
  }
}