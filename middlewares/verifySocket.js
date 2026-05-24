import jwt from "jsonwebtoken";
import { config } from "dotenv";

config();

export const verifysocket = (
  socket,
  next
) => {

  try {

    const cookies =
      socket.handshake.headers.cookie;

    if (!cookies) {
      return next(
        new Error(
          "Unauthorized: No cookie"
        )
      );
    }

    // extract token cookie
    const token =
      cookies
        .split("; ")
        .find((row) =>
          row.startsWith("token=")
        )
        ?.split("=")[1];

    if (!token) {
      return next(
        new Error(
          "Unauthorized: No token"
        )
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    socket.user = decoded;

    next();

  } catch (err) {

    console.log(
      "SOCKET AUTH ERROR:",
      err.message
    );

    next(
      new Error("Unauthorized")
    );
  }
};