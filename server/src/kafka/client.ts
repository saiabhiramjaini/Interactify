import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "my-app", // Used to identify your app in logs/metrics
  brokers: ["192.168.1.6:9092"], // Replace with your machine's private IP
});