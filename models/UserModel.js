import { Schema,model } from "mongoose";

//create user schema(username,email,password,gender)
const UserSchema = new Schema({
    username:{
        type:String,
        required:[true,"Username required"],
        minLength:[4,"minimum 4 characters"],
        maxLength:[10,"maximum 10 characters"],
        unique:[true,"username already exists"],
        trim:true
    
    },
    email:{
        type:String,
        required:[true,"email required"],
        unique:[true,"email already exists"],
        toLowerCase:true
    },
    password:{
        type:String,
        required:[true,"password required"]
    },
    gender:{
        type:String,
        enum:['MALE','FEMALE','OTHERS'],
        required:[true,"gender required"]
    },
    profileImageUrl:{
        type:String
    },
    isUserActive:{ //for soft deleting 
        type:Boolean,
        default:true
    },
    preferences: {

        darkMode: {
            type: Boolean,
            default: false
        },

        compactMode: {
            type: Boolean,
            default: false
        }
    },

    privacySettings: {
        showOnlineStatus: { type: Boolean, default: true },
        readReceipts: { type: Boolean, default: true }
    },

    // Incrementing this value invalidates existing tokens when changed
    tokenVersion: {
        type: Number,
        default: 0
    },
},{
    timestamps:true,
    versionKey:false,
    strict:'throw'
}
)

export const UserModel=model('user',UserSchema)