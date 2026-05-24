import jwt from 'jsonwebtoken'
import { config } from 'dotenv'
import { UserModel } from '../models/UserModel.js'
const {verify} = jwt
config()

export async function verifyToken(req,res,next){
    //token verification logic
    const token=req.cookies?.token
    //if req from unauthorized user
    if(!token){
        return res.status(401).json({message:'please login'})
    }
    try{
    //if token valid
    const decodedtoken=verify(token,process.env.SECRET_KEY)//returns error if token is invalid

    // verify user still exists and tokenVersion matches
    const user = await UserModel.findById(decodedtoken.userId).select('tokenVersion')
    if(!user){
        return res.status(401).json({message:'please login'})
    }

    if ((decodedtoken.tokenVersion || 0) !== (user.tokenVersion || 0)) {
        return res.status(401).json({message:'session expired. login again'})
    }

    // attach encoded user to req
    req.user = { userId: decodedtoken.userId }
    next()
    }catch(err){
        res.status(401).json({message:'session expired. login again'})
    }
}