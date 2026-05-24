// setupSocket.js

import { MessageModel } from "../models/MessageModel.js";
import { chatModel } from "../models/ChatModel.js";
import { verifysocket } from "../middlewares/verifySocket.js";

export const setupSocket = (io) => {

  const onlineUsers = {};

  io.use(verifysocket);

  io.on("connection", (socket) => {

    const userId =
      socket.user.userId;

    onlineUsers[userId] =
      socket.id;

    console.log(
      "USER CONNECTED:",
      userId
    );

    // JOIN CHANNEL
    socket.on(
      "join-channel",
      (channelId) => {

        socket.join(channelId);

        console.log(
          `USER ${userId} JOINED ${channelId}`
        );
      }
    );

    // COMMON POPULATE
    const populateMessage =
      async (id) =>
        await MessageModel.findById(id)
          .populate(
            "sender",
            "username email profileImage"
          )
          .populate(
            "reactions.user",
            "username"
          )
          .populate({
            path: "threadReplies",
            populate: {
              path: "sender",
              select:
                "username email profileImage",
            },
          });

    // CHANNEL MESSAGE
    socket.on(
      "send-channel-message",
      async ({
        channelId,
        content,
      }) => {

        try {

          const message =
            await MessageModel.create({
              sender: userId,
              channel: channelId,
              content,
            });

          await chatModel.findByIdAndUpdate(
            channelId,
            {
              latestMessage:
                message._id,
            }
          );

          const populatedMessage =
            await populateMessage(
              message._id
            );

          io.to(channelId).emit(
            "receive-channel-message",
            populatedMessage
          );

        } catch (err) {

          console.log(err);
        }
      }
    );

    // DM MESSAGE
    socket.on(
      "send-dm",
      async ({
        receiverId,
        content,
        chatId,
      }) => {

        try {

          const message =
            await MessageModel.create({
              sender: userId,
              receiver: receiverId,
              content,
            });

          await chatModel.findByIdAndUpdate(
            chatId,
            {
              latestMessage:
                message._id,
            }
          );

          const populatedMessage =
            await populateMessage(
              message._id
            );

          const receiverSocket =
            onlineUsers[
              receiverId
            ];

          if (receiverSocket) {

            io.to(receiverSocket).emit(
              "receive-dm",
              populatedMessage
            );
          }

          socket.emit(
            "receive-dm",
            populatedMessage
          );

        } catch (err) {

          console.log(err);
        }
      }
    );

    // THREAD MESSAGE
    socket.on(
  "send-thread-message",
  async ({ parentMessageId, content, chatId }) => {
    try {
      const reply = await MessageModel.create({
        sender: userId,
        content,
        channel: chatId,
        parentMessage: parentMessageId,
      });

      const updatedParent = await MessageModel.findByIdAndUpdate(
        parentMessageId,
        {
          $push: { threadReplies: reply._id },
        },
        { new: true }
      ).populate("sender", "username");

      const populatedReply = await MessageModel.findById(reply._id)
        .populate("sender", "username");

      // ✅ IMPORTANT: CLEAN CONSISTENT PAYLOAD
      io.to(chatId).emit("thread-message-received", {
        parentMessageId: parentMessageId,
        reply: populatedReply,
        parentMessage: updatedParent,
      });

    } catch (err) {
      console.log("THREAD ERROR:", err);
    }
  }
);

    // REACT MESSAGE
    socket.on(
      "react-message",
      async ({
        messageId,
        emoji,
      }) => {

        try {

          const message =
            await MessageModel.findById(
              messageId
            );

          if (!message)
            return;

          const exists =
            message.reactions.find(
              (r) =>
                r.user.toString() ===
                  userId &&
                r.emoji === emoji
            );

          if (exists) {

            message.reactions =
              message.reactions.filter(
                (r) =>
                  !(
                    r.user.toString() ===
                      userId &&
                    r.emoji === emoji
                  )
              );

          } else {

            message.reactions.push({
              user: userId,
              emoji,
            });
          }

          await message.save();

          const updatedMessage =
            await populateMessage(
              message._id
            );

          if (message.channel) {

            io.to(
              message.channel.toString()
            ).emit(
              "reaction-updated",
              updatedMessage
            );

          } else {

            const receiverSocket =
              onlineUsers[
                message.receiver?.toString()
              ];

            if (receiverSocket) {

              io.to(receiverSocket).emit(
                "reaction-updated",
                updatedMessage
              );
            }

            socket.emit(
              "reaction-updated",
              updatedMessage
            );
          }

        } catch (err) {

          console.log(err);
        }
      }
    );

    // EDIT MESSAGE
    socket.on(
      "edit-message",
      async ({
        messageId,
        newContent,
      }) => {

        try {

          const message =
            await MessageModel.findById(
              messageId
            );

          if (
            !message ||
            message.sender.toString() !==
              userId
          ) return;

          message.content =
            newContent;

          message.isEdited =
            true;

          message.editedAt =
            new Date();

          await message.save();

          const updatedMessage =
            await populateMessage(
              messageId
            );

          io.emit(
            "message-edited",
            updatedMessage
          );

        } catch (err) {

          console.log(err);
        }
      }
    );

    // SEND FILE
    socket.on(
      "send-file",
      async ({
        chatId,
        chatType,
        receiverId,
        attachments,
        content,
      }) => {

        try {

          const formattedAttachments =
            (attachments || []).map(
              (file) => ({

                url:
                  file.url ||
                  file.secure_url,

                name:
                  file.name ||
                  file.originalname,

                type:
                  file.type ||
                  file.mimetype,

                public_id:
                  file.public_id || "",
              })
            );

          const messageData = {
            sender: userId,
            content:
              content || "",
            attachments:
              formattedAttachments,
          };

          if (
            chatType === "dm"
          ) {

            messageData.receiver =
              receiverId;

          } else {

            messageData.channel =
              chatId;
          }

          const message =
            await MessageModel.create(
              messageData
            );

          await chatModel.findByIdAndUpdate(
            chatId,
            {
              latestMessage:
                message._id,
            }
          );

          const populatedMessage =
            await populateMessage(
              message._id
            );

          if (
            chatType === "dm"
          ) {

            const receiverSocket =
              onlineUsers[
                receiverId
              ];

            if (
              receiverSocket
            ) {

              io.to(receiverSocket).emit(
                "receive-dm",
                populatedMessage
              );
            }

            socket.emit(
              "receive-dm",
              populatedMessage
            );

          } else {

            io.to(chatId).emit(
              "receive-channel-message",
              populatedMessage
            );
          }

        } catch (err) {

          console.log(err);
        }
      }
    );

    // DISCONNECT
    socket.on(
      "disconnect",
      () => {

        delete onlineUsers[
          userId
        ];

        console.log(
          "USER DISCONNECTED:",
          userId
        );
      }
    );
  });
};