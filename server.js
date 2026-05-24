import exp from 'express'
import { connect } from 'mongoose'
import { config } from 'dotenv'
import { createServer } from 'node:http'
import { Server } from "socket.io";
import cors from 'cors'
import { userApp } from './APIs/UserAPI.js';
import { chatApp } from './APIs/ChannelAPI.js';
import cookieParser from 'cookie-parser'
import { setupSocket } from "./Sockets/Socket.js";
import { messageApp } from "./APIs/MessageAPI.js";
import { fileTransferApp } from "./APIs/FileTransferAPI.js"
import googleAuthRoute from './APIs/GoogleAPI.js'
import dns from "node:dns/promises";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// ✅ Load env vars FIRST before anything else reads them
config()

const app = exp()
const server = createServer(app)

// ✅ Build allowed origins from environment variables
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS?.split(',') ?? [])
]
  .map(o => o?.trim())
  .filter(Boolean)

console.log('Allowed origins:', allowedOrigins)

// ✅ HTTP CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

// Body parser
app.use(exp.json())

// Cookie parser
app.use(cookieParser())

// Routes
app.use('/user-api', userApp)
app.use('/chat-api', chatApp)
app.use('/message-api', messageApp)
app.use('/fileTransfer-api', fileTransferApp)
app.use('/auth', googleAuthRoute)
app.use('/uploads', exp.static('uploads'))

// ✅ Socket.IO with same allowed origins
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
})

setupSocket(io)

const PORT = parseInt(process.env.PORT, 10) || 3000

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err)
  process.exit(1)
})

const connectDB = async () => {
  try {
    await connect(process.env.DB_URL)
    console.log('DB connected')

    if (server.listening) {
      console.log(`Server already listening on port ${PORT}`)
      return
    }

    server.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
  } catch (error) {
    console.error('Error connecting to DB:', error.message)
    process.exit(1)
  }
}

connectDB()

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation error', error: err })
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Cast error', error: err })
  }

  res.status(500).json({ message: 'Server error', error: err.message })
})