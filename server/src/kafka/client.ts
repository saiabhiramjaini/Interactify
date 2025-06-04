import { Kafka } from "kafkajs";
import dotenv from "dotenv";
dotenv.config();

export const kafka = new Kafka({
  clientId: "interactify-server", 
  brokers: [`${process.env.PRIVATE_IP}:9092`], 
});