import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  reconnectionAttempts: 3,
  timeout: 5000,
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("Connect error:", err.message);
  process.exit(1);
});
