import { Request, Response, NextFunction } from "express";
import AppError from "../library/errorClass";
import jwt from "jsonwebtoken";
import { IDecode, responseStatusCodes } from "../library/interfaces";
import User from "../models/users";
import { config } from "dotenv";

config();

class Authentication {
  static async middleware(req: Request, res: Response, next: NextFunction) {
    // Get token from headers
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token)
      throw new AppError({
        message: "Please Authenticate",
        statusCode: responseStatusCodes.UNAUTHORIZED,
      });
    try {
      //   Verify Token
      const decoded = <IDecode>jwt.verify(token, JWT_SECRET);
      //   Get user from database
      const user = await User.findOne({
        _id: decoded._id,
        "tokens.token": token,
      });

      if (!user)
        throw new AppError({
          message: "Please Authenticate",
          statusCode: responseStatusCodes.UNAUTHORIZED,
        });
      // Add user to request
      req.user = user;
      req.token = token;
      next();
    } catch (error: any) {
      if (error.name === "JsonWebTokenError")
        return res.status(responseStatusCodes.BAD_REQUEST).json({
          STATUS: "FAILURE",
          ERROR: "Invalid Token",
        });
      next(error);
    }
  }
}

// Fectching JsonwebToken secret
const JWT_SECRET = process.env.JWT_SECRET as string;

export default Authentication.middleware;
