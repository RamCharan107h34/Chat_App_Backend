import exp from "express";
import { chatModel } from "../models/ChatModel.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { UserModel } from "../models/UserModel.js";

export const chatApp = exp.Router();

// ================= CREATE CHANNEL =================
chatApp.post("/chats/channel", verifyToken, async (req, res) => {
  const { channelName, members = [] } = req.body;
  const adminId = req.user.userId;

  if (!channelName)
    return res.status(400).json({ message: "channel name required" });

  const users = await UserModel.find({ email: { $in: members } });

  if (users.length !== members.length) {
    const found = users.map((u) => u.email);
    const invalidEmails = members.filter((e) => !found.includes(e));
    return res.status(400).json({ message: "invalid emails", invalidEmails });
  }

  const memberIds = users.map((u) => u._id);

  const channel = await chatModel.create({
    channelName,
    type: "channel",
    members: [adminId],
    admin: adminId,
    inviteRequests: users.map((u) => ({ user: u._id, invitedBy: adminId })),
  });

  const populated = await channel.populate(
    "members admin inviteRequests.user inviteRequests.invitedBy",
    "username email"
  );

  res.status(200).json({ message: "channel created", payload: populated });
});

// ================= CREATE DM =================
chatApp.post("/chats/dm", verifyToken, async (req, res) => {
  const userId = req.user.userId;
  const newUser = req.body.members;

    const other = await UserModel.findById(newUser)
  if (!other) return res.status(404).json({ message: "user not found" });

  if (other._id.toString() === userId.toString())
    return res.status(400).json({ message: "cannot DM self" });

  const members = [userId, other._id];

  const existing = await chatModel.findOne({
    type: "dm",
    members: { $all: members, $size: 2 },
  });

  if (existing) {
    const populated = await existing.populate("members", "username email");
    return res.status(200).json({ message: "dm exists", payload: populated });
  }

  const dm = await chatModel.create({ type: "dm", members });

  const populated = await dm.populate("members", "username email");

  res.status(200).json({ message: "dm created", payload: populated });
});

// ================= GET CHANNELS =================
chatApp.get("/chats/channels", verifyToken, async (req, res) => {
  const userId = req.user.userId;

  const channels = await chatModel
    .find({ type: "channel", members: userId })
    .populate("members admin", "username email")
    .lean();

  res.status(200).json({ message: "channels", payload: channels });
});

// ================= GET CHANNEL NOTIFICATIONS =================
chatApp.get("/chats/notifications", verifyToken, async (req, res) => {
  const userId = req.user.userId;

  const adminChannels = await chatModel
    .find({ type: "channel", admin: userId, "joinRequests.0": { $exists: true } })
    .populate("members admin joinRequests.user", "username email")
    .lean();

  const invitedChannels = await chatModel
    .find({ type: "channel", "inviteRequests.user": userId })
    .populate("admin inviteRequests.user inviteRequests.invitedBy", "username email")
    .lean();

  res.status(200).json({
    message: "notifications",
    payload: { adminChannels, invitedChannels },
  });
});

// ================= GET DMS =================
chatApp.get("/chats/dms", verifyToken, async (req, res) => {
  const userId = req.user.userId;

  const dms = await chatModel
    .find({ type: "dm", members: userId })
    .populate("members", "username email profileImage")
    .lean();

  res.status(200).json({ message: "dms", payload: dms });
});

// ================= SEARCH USER BY EMAIL =================
chatApp.get("/users/search", verifyToken, async (req, res) => {
  const { email } = req.query;

  if (!email)
    return res.status(400).json({ message: "email required" });

  const user = await UserModel.findOne({ email });

  if (!user)
    return res.status(404).json({ message: "user not found" });

  res.status(200).json({ payload: user });
});

// ================= ADD MEMBERS (EMAIL BASED) =================
chatApp.put("/add-members", verifyToken, async (req, res) => {
  const { channelId, emails = [] } = req.body;
  const adminId = req.user.userId;

  const channel = await chatModel.findById(channelId);

  if (!channel)
    return res.status(404).json({ message: "channel not found" });

  if (channel.type === "dm")
    return res.status(400).json({ message: "dm cannot have members" });

  if (channel.admin.toString() !== adminId.toString())
    return res.status(403).json({ message: "only admin can add members" });

  const users = await UserModel.find({ email: { $in: emails } });

  if (users.length !== emails.length) {
    const found = users.map((u) => u.email);
    const invalid = emails.filter((e) => !found.includes(e));
    return res.status(400).json({ message: "invalid emails", invalid });
  }

  const ids = users.map((u) => u._id);

  const alreadyMembers = ids.filter((id) =>
    channel.members.some(
      (member) => member.toString() === id.toString()
    )
  );

  if (alreadyMembers.length > 0) {
    return res.status(400).json({
      message: "some users are already members",
      alreadyMembers,
    });
  }

  const alreadyInvited = ids.filter((id) =>
    channel.inviteRequests.some(
      (request) => request.user.toString() === id.toString()
    )
  );

  if (alreadyInvited.length > 0) {
    return res.status(400).json({
      message: "some users are already invited",
      alreadyInvited,
    });
  }

  ids.forEach((id) =>
    channel.inviteRequests.push({ user: id, invitedBy: adminId })
  );

  await channel.save();

  const populated = await chatModel
    .findById(channelId)
    .populate(
      "members admin inviteRequests.user inviteRequests.invitedBy",
      "username email"
    );

  res.status(200).json({ message: "invite sent", payload: populated });
});

// ================= GET MEMBERS =================
chatApp.get("/members", verifyToken, async (req, res) => {
  const { channelId } = req.query;

  if (!channelId)
    return res.status(400).json({ message: "channelId required" });

  const channel = await chatModel
    .findById(channelId)
    .populate("members admin", "username email")
    .lean();

  if (!channel)
    return res.status(404).json({ message: "channel not found" });

  if (channel.type === "dm")
    return res.status(400).json({ message: "dm has no members" });

  res.status(200).json({ payload: channel.members });
});

// ================= DELETE CHANNEL =================
chatApp.delete("/delete", verifyToken, async (req, res) => {
  const { channelId } = req.body;
  const userId = req.user.userId;

  const channel = await chatModel.findById(channelId);

  if (!channel)
    return res.status(404).json({ message: "channel not found" });

  if (channel.admin.toString() !== userId.toString())
    return res.status(403).json({ message: "only admin can delete" });

  await chatModel.findByIdAndDelete(channelId);

  res.status(200).json({ message: "channel deleted" });
});

// ================= LEAVE CHANNEL =================
chatApp.post("/chats/leave", verifyToken, async (req, res) => {
  const { channelId } = req.body;
  const userId = req.user.userId;

  const channel = await chatModel.findById(channelId);

  if (!channel)
    return res.status(404).json({ message: "channel not found" });

  if (channel.type !== "channel")
    return res.status(400).json({ message: "invalid channel" });

  if (channel.admin.toString() === userId.toString())
    return res.status(400).json({ message: "admin cannot leave" });

  channel.members = channel.members.filter(
    (m) => m.toString() !== userId.toString()
  );

  await channel.save();

  res.status(200).json({ message: "left channel" });
});

//get channel by channelName
chatApp.get('/channels/search',verifyToken,async(req,res)=>{
    // get channelName from query string
    const { name = "" } = req.query;

    if (!name.trim()) {
        return res.status(200).json({ payload: [] });
    }

    const channels = await chatModel.find({
        type: "channel",
        channelName: {
            $regex: name,
            $options: "i"
        },
    });

    res.status(200).json({
        payload: channels
    })
})

// SEARCH USER BY EMAIL
chatApp.get(
  "/users/search",
  verifyToken,
  async (req, res, next) => {

      const { email } = req.query;

      if (!email) {

        const err = new Error(
          "Email is required"
        );

        err.status = 400;

        return next(err);
      }

      const user = await UserModel
        .findOne({ email })
        .select("-password");

      if (!user) {

        const err = new Error(
          "User not found"
        );

        err.status = 404;

        return next(err);
      }

      res.status(200).json({
        success: true,
        payload: user,
      });
  }
);

//JOIN REQUEST
chatApp.post(
    '/chats/join-request',
    verifyToken,
    async (req, res) => {

        try {

            const userId = req.user.userId;

            const { channelId } = req.body;

            if (!channelId) {
                return res.status(400).json({
                    message: 'channelId is required'
                });
            }

            const channel =
                await chatModel.findOne({
                    _id: channelId,
                    type: 'channel'
                });

            if (!channel) {
                return res.status(404).json({
                    message: 'channel not found'
                });
            }

            const alreadyMember =
                channel.members.some(
                    member =>
                        member.toString() ===
                        userId.toString()
                );

            if (alreadyMember) {
                return res.status(400).json({
                    message:
                        'already a member of this channel'
                });
            }

            const existingRequest =
                channel.joinRequests?.some(
                    request =>
                        request.user.toString() ===
                        userId.toString()
                );

            if (existingRequest) {
                return res.status(400).json({
                    message:
                        'join request already pending'
                });
            }

            channel.joinRequests.push({
                user: userId
            });

            await channel.save();

            res.status(200).json({
                message:
                    'join request sent successfully'
            });

        } catch (err) {

            console.log(err);

            res.status(500).json({
                message:
                    'server error creating join request'
            });
        }
    }
)

//APPROVE OR REJECT REQUEST
chatApp.post(
    '/chats/approve-request',
    verifyToken,
    async (req, res) => {

        try {

            const adminId = req.user.userId;

            const {
                channelId,
                userId,
                approve
            } = req.body;

            if (!channelId || !userId) {
                return res.status(400).json({
                    message:
                        'channelId and userId are required'
                });
            }

            const channel =
                await chatModel.findOne({
                    _id: channelId,
                    type: 'channel'
                });

            if (!channel) {
                return res.status(404).json({
                    message:
                        'channel not found'
                });
            }

            if (
                channel.admin.toString() !==
                adminId.toString()
            ) {
                return res.status(403).json({
                    message:
                        'only admin can approve requests'
                });
            }

            const requestIndex =
                channel.joinRequests.findIndex(
                    request =>
                        request.user.toString() ===
                        userId.toString()
                );

            if (requestIndex === -1) {
                return res.status(400).json({
                    message:
                        'no pending request found'
                });
            }

            // REMOVE REQUEST
            channel.joinRequests.splice(
                requestIndex,
                1
            );

            // APPROVE
            if (approve) {

                const alreadyMember =
                    channel.members.some(
                        member =>
                            member.toString() ===
                            userId.toString()
                    );

                if (!alreadyMember) {
                    channel.members.push(userId);
                }
            }

            await channel.save();

            res.status(200).json({
                message: approve
                    ? "request approved"
                    : "request rejected",
                payload: channel,
            });

        } catch (err) {

            console.log(err);

            res.status(500).json({
                message:
                    'server error processing request'
            });
        }
    }
);

// ================= RESPOND TO INVITE =================
chatApp.post(
    '/chats/respond-invite',
    verifyToken,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const { channelId, approve } = req.body;

            if (!channelId) {
                return res.status(400).json({
                    message: 'channelId is required'
                });
            }

            const channel = await chatModel.findOne({
                _id: channelId,
                type: 'channel'
            });

            if (!channel) {
                return res.status(404).json({
                    message: 'channel not found'
                });
            }

            const requestIndex = channel.inviteRequests.findIndex(
                (request) =>
                    request.user.toString() === userId.toString()
            );

            if (requestIndex === -1) {
                return res.status(400).json({
                    message: 'no pending invite found'
                });
            }

            channel.inviteRequests.splice(requestIndex, 1);

            if (approve) {
                const alreadyMember = channel.members.some(
                    (member) => member.toString() === userId.toString()
                );

                if (!alreadyMember) {
                    channel.members.push(userId);
                }
            }

            await channel.save();

            res.status(200).json({
                message: approve ? 'invite accepted' : 'invite rejected',
                payload: channel,
            });
        } catch (err) {
            console.log(err);
            res.status(500).json({
                message: 'server error processing invite'
            });
        }
    }
);
