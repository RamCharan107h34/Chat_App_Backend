import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect",() => {
  console.log("Connected to server");
  console.log("Socket ID:", socket.id);

  // Send test message
  socket.emit("sendMessage", {
    sender: oo,
    receiver: "69f97ac01d362e1cecc3f39c",
    content: "Hello from client",
  });
});

// Listen for incoming messages
socket.on("receiveMessage", (data) => {
  console.log("New message:", data);
});