import exp from 'express'
import {hash,compare} from 'bcryptjs'
import {UserModel} from '../models/UserModel.js'
import jwt from 'jsonwebtoken'
const {sign}=jwt
import { verifyToken } from '../middlewares/verifyToken.js'
import {config} from 'dotenv'
import {upload} from '../config/multer.js'
import {uploadToCloudinary } from '../config/cloudinaryUpload.js'
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js'

config()


export const userApp = exp.Router()

//Create New User
    userApp.post('/users',upload.single("profileImageUrl"),async(req,res,next)=>{
      let cloudinaryResult;
      try{
        //get new user obj from req
        const newUser=req.body
        console.log(newUser)
        //hash the password
        const hashedPassword=await hash(newUser.password,10)
        //replace original password with hashed password
        newUser.password=hashedPassword
        if(req.file){
          cloudinaryResult = await uploadToCloudinary(req.file.buffer)
          newUser.profileImageUrl = cloudinaryResult.secure_url;
        }
        //create new user document
        const NewUserDocument=new UserModel(newUser)
        //save
        let result=await NewUserDocument.save()
        //send response
        res.status(201).json({message:'User Created'})//it is mandatory to send status code
      } catch (err) {
    console.log("err is ", err);
    // delete image from cloudinary if upload happened
    if (cloudinaryResult?.public_id && isCloudinaryConfigured) {
      try {
        await cloudinary.uploader.destroy(cloudinaryResult.public_id);
      } catch (cleanupErr) {
        console.log("cloudinary cleanup failed", cleanupErr.message);
      }
    }
    next(err);
  }
    })
   

//user login
userApp.post('/login', async (req, res) => {
    const { email, password } = req.body;
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    // Find user by email
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    // If user doesn't exist
    if (!user) {
      return res.status(400).json({ message: 'Invalid email' });
    }
    // Compare password using bcrypt
    const isPasswordMatch = await compare(password, user.password);
    // If password doesn't match
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }
    // Check if account is deactivated
    if (!user.isUserActive) {
      return res.status(403).json({
        message: 'Account is deactivated',
        activateRequired: true,
        email: user.email,
      });
    }
    // Create JWT token
    const signedToken = sign(
      { userId: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.SECRET_KEY,
      { expiresIn: '1h' }
    );
    // Store token as HTTP-only cookie
    res.cookie("token", signedToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 1000
    });
    // Send successful response
    res.status(200).json({
      message: 'Login successful',
      payload: {
        _id: user._id,
        username: user.username,
        email: user.email,
        gender: user.gender,
        profileImageUrl: user.profileImageUrl,
        preferences: user.preferences,
        notificationSettings: user.notificationSettings,
        privacySettings: user.privacySettings,
        chatPreferences: user.chatPreferences,
      },
    });
});

// Activate deactivated account
userApp.post('/activate-account', async (req, res) => {
    const { email, password } = req.body;
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    // Find user by email
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    // If user doesn't exist
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Compare password using bcrypt
    const isPasswordMatch = await compare(password, user.password);
    // If password doesn't match
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    // Check if account is already active
    if (user.isUserActive) {
      return res.status(400).json({ message: 'Account is already active' });
    }
    // Activate account
    user.isUserActive = true;
    await user.save();
    // Send success response
    res.status(200).json({
      message: 'Account activated successfully',
      email: user.email,
    });
});

//Route for Logout
userApp.get("/logout", (req, res) => {
  //delete token from cookie storage
  res.clearCookie("token", {
    httpOnly:true,
    sameSite:"none",
    secure:true
  });
  //send res
  res.status(200).json({ message: "Logout success" });
});

  // Logout from all devices - increments tokenVersion to invalidate existing tokens
  userApp.post("/logout-all", verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });

      // clear cookie on this device as well
      res.clearCookie("token", {
        httpOnly: true,
        sameSite: "none",
        secure: true
      });

      res.status(200).json({ message: "Logged out from all devices" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

//update user 
userApp.put("/users", verifyToken, async (req, res) => {
  try {
    const userIdFromToken = req.user.userId;

    const { username, email, oldPassword, newPassword, gender, profileImageUrl } = req.body;

    const updates = {};

    //  Get current user first
    const currentUser = await UserModel.findById(userIdFromToken);

    if (!currentUser) {
      return res.status(404).json({ msg: "User not found" });
    }
    const isPasswordChangeRequested = typeof newPassword === "string" && newPassword.length > 0;

    if (isPasswordChangeRequested) {
      if (typeof oldPassword !== "string" || oldPassword.length === 0) {
        return res.status(400).json({message: "Old password is required"});
      }

      const isMatch = await compare(oldPassword, currentUser.password);

      if (!isMatch) {
        return res.status(400).json({message: "Old password is incorrect"});
      }
    }
    //  USERNAME
    if (username) {
      const userExists = await UserModel.findOne({ username });
      if (userExists && userExists._id.toString() !== currentUser._id.toString()) {
        return res.status(400).json({ msg: "Username already exists" });
      }
      updates.username = username.trim();
    }
    //  EMAIL
    if (email) {
      const emailLower = email.toLowerCase();
      const emailExists = await UserModel.findOne({ email: emailLower });
      if (emailExists && emailExists._id.toString() !== currentUser._id.toString()) {
        return res.status(400).json({ msg: "Email already exists" });
      }
      updates.email = emailLower.trim();
    }

    //  PASSWORD
    if (isPasswordChangeRequested) {
      updates.password = await hash(newPassword, 10);
    } 

    //  GENDER
    if (gender) {
      updates.gender = gender; // MALE/FEMALE/OTHERS
    }

    //  PROFILE IMAGE
    if (profileImageUrl) {
      updates.profileImageUrl = profileImageUrl;
    }

    //  UPDATE USER
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: currentUser._id },
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true
      }
    ).select("-password");

    res.status(200).json({
      msg: "User updated successfully",
      user: updatedUser
    });

  } catch (err) {
    console.log(err);

    // Duplicate key fallback (11000)
    if (err.code === 11000) {
      return res.status(400).json({
        msg: "Duplicate value error",
        field: err.keyValue ? Object.keys(err.keyValue)[0] : "unknown"
      });
    }

    res.status(500).json({ error: err.message });
  }
});

//Route to get user by username
userApp.get("/find-user", async(req,res)=>{
    try{
        //get username
    const {username}=req.body;
    //read user by username
    const user=await UserModel.findOne({username:username});

    //if user not found
    if(!user)
    {
        return res.status(404).json({ message: "user not found" })
    }
    //if user found send res
    res.status(200).json({
        message:"user found",
        payload:user
    })

    }catch(err) //if any error occurs
    {
        res.status(500).json({message:err.message})
    }

})

//delete user 
userApp.delete("/delete-user",verifyToken,async (req, res) => {
        //get user id from token
        const Id = req.user?.userId;
        
        //user document
        const UserDocument= await UserModel.findById(Id)
       
        //check if user exists
          if (!UserDocument) {
            return res.status(404).json({ message: "user not found" })
        }

        //check status
         if ( UserDocument.isUserActive === false) {
    return res.status(200).json({ message: "user already in the same state" });
  }
         await UserModel.findByIdAndUpdate(Id, {
      isUserActive: false
    });

    // logout user
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "none",
      secure: true
    });

    res.status(200).json({
      message: "Account deactivated successfully"
    });
})
import bcrypt from "bcrypt";

userApp.put("/activate-user", async (req, res) => {
    const { email, password } = req.body;
    // find user
    const userDocument = await UserModel
      .findOne({ email })
      .select("+password");
    // check user exists
    if (!userDocument) {
      return res.status(404).json({message: "User not found"});
    }

    // compare password
    const isMatch = await bcrypt.compare(password,userDocument.password);
    //if passwords not matched
    if (!isMatch) {
      return res.status(400).json({message: "Invalid password"});
    }
    // already active
    if (userDocument.isUserActive === true) {
      return res.status(200).json({message: "User already active"});
    }
    // activate user
    userDocument.isUserActive = true;

    await userDocument.save();

    res.status(200).json({message: "Account activated successfully"});

});

//page refresh
userApp.get("/check-auth", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const user = await UserModel.findById(userId).select("_id username email gender profileImageUrl preferences notificationSettings privacySettings chatPreferences");

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    res.status(200).json({
      message: "authenticated",
      payload: user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



//to change appearance mode
userApp.put("/preferences",verifyToken,async (req, res) => {
      const userId = req.user.userId;
        const {
          darkMode,
          compactMode,
          soundNotifications,
          desktopNotifications,
          showOnlineStatus,
          readReceipts,
          enterToSend,
          showTypingIndicators
        } = req.body;

        const updates = {};

        if (typeof darkMode !== 'undefined') updates['preferences.darkMode'] = darkMode;
        if (typeof compactMode !== 'undefined') updates['preferences.compactMode'] = compactMode;

        if (typeof soundNotifications !== 'undefined') updates['notificationSettings.soundNotifications'] = soundNotifications;
        if (typeof desktopNotifications !== 'undefined') updates['notificationSettings.desktopNotifications'] = desktopNotifications;

        if (typeof showOnlineStatus !== 'undefined') updates['privacySettings.showOnlineStatus'] = showOnlineStatus;
        if (typeof readReceipts !== 'undefined') updates['privacySettings.readReceipts'] = readReceipts;

        if (typeof enterToSend !== 'undefined') updates['chatPreferences.enterToSend'] = enterToSend;
        if (typeof showTypingIndicators !== 'undefined') updates['chatPreferences.showTypingIndicators'] = showTypingIndicators;

        const updatedUser = await UserModel.findByIdAndUpdate(
          userId,
          { $set: updates },
          { returnDocument: 'after' }
        ).select('-password');

        res.status(200).json({ message: 'Preferences updated', user: updatedUser });
});