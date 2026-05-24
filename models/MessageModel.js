import mongoose, {
  Schema,
  model,
} from "mongoose";

const attachmentSchema = new Schema(
  {
    url: {
      type: String,
    },

    type: {
      type: String,
    },

    name: {
      type: String,
    },

    public_id: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    receiver: {
      type: Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    parentMessage: {
  type: Schema.Types.ObjectId,
  ref: "message",
  default: null,
},

    channel: {
      type: Schema.Types.ObjectId,
      ref: "chat",
      default: null,
    },

    content: {
      type: String,
      trim: true,
      default: "",
    },

    threadReplies: [
  {
    type: Schema.Types.ObjectId,
    ref: "message",
  },
],

reactions: [
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    emoji: String,
  },
],

    attachments: {
      type: [attachmentSchema],
      default: [],
    },
  },
  { timestamps: true }
);


export const MessageModel =
  mongoose.models.message ||
  mongoose.model(
    "message",
    messageSchema
  );