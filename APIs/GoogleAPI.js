import express from "express"
import { OAuth2Client } from "google-auth-library"
import jwt from "jsonwebtoken"
import { config } from "dotenv"
import { UserModel } from "../models/UserModel.js"

const Router = express.Router()
config()

Router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body
    const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()

    if (!googleClientId) {
      return res.status(500).json({ success: false, message: "Google client not configured" })
    }

    if (!credential) {
      return res.status(400).json({ success: false, message: "Google credential is required" })
    }

    const client = new OAuth2Client(googleClientId)

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId
    })

    const payload = ticket.getPayload()
    const googleEmail = payload.email
    const googleName = payload.name
    const googlePicture = payload.picture

    // Check if user exists
    let user = await UserModel.findOne({ email: googleEmail })

    // If user doesn't exist, create new user
    if (!user) {
      // Generate username from email (remove domain part)
      const baseUsername = googleEmail.split('@')[0].substring(0, 10)
      let username = baseUsername
      let counter = 1

      // Ensure username is unique
      while (await UserModel.findOne({ username })) {
        username = `${baseUsername}${counter}`
        counter++
      }

      user = await UserModel.create({
        username: username,
        email: googleEmail,
        password: Math.random().toString(36).slice(-20), // Random password since Google user won't need it
        gender: 'OTHERS', // Default gender for Google users
        profileImageUrl: googlePicture
      })
    }

    // Create JWT token with userId (critical for verifyToken middleware)
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        email: user.email,
        tokenVersion: user.tokenVersion || 0
      },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    )

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    })

    res.json({
  success: true,
  user: {
    _id: user._id,
    username: user.username,    // ← to this
    email: user.email,
    profileImageUrl: user.profileImageUrl
  }
})

  } catch (error) {
    console.log("Google auth error:", error)
    res.status(500).json({ success: false, message: "Google login failed" })
  }

})

export default Router;