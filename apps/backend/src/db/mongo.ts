import mongoose from "mongoose";

let isConnected = false;

export async function connectToDatabase(mongoUri: string): Promise<void> {
  if (isConnected) {
    return;
  }

  await mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 10000,
  family: 4, // force IPv4
});
  isConnected = true;
}
