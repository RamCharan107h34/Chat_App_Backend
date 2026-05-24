import { Schema, model, Types } from "mongoose";

const chatSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["channel", "dm"],
      required: true,
    },

    channelName: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    members: [
      {
        type: Types.ObjectId,
        ref: "user",
      },
    ],

    isChannelActive: {
      type: Boolean,
      default: true,
    },

    admin: {
      type: Types.ObjectId,
      ref: "user",
    },

    latestMessage: {
      type: Types.ObjectId,
      ref: "message",
    },
    joinRequests: [
      {
        user: {
          type: Types.ObjectId,
          ref: "user",
        },

        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    inviteRequests: [
      {
        user: {
          type: Types.ObjectId,
          ref: "user",
        },
        invitedBy: {
          type: Types.ObjectId,
          ref: "user",
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

export const chatModel = model("chat", chatSchema);