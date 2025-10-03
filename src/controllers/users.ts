import { RequestHandler } from "express";
import AppError from "../library/errorClass";
import { IUser, responseStatusCodes } from "../library/interfaces";
import Logger from "../library/logger";
import { responseHelper } from "../library/responseHelper";
import User from "../models/users";
import crypto from "crypto";

export default class Controller {
  static signup: RequestHandler = async (req, res, next) => {
    const { email } = req.body as {
      email: IUser["email"];
      firstName: IUser["firstName"];
    };
    try {
      //Check if there is a registered account with the email
      const existingUser = await User.findOne({ email });
      if (existingUser)
        throw new AppError({
          message: "User already exist",
          statusCode: responseStatusCodes.CONFLICT,
        });
      //Create User account
      const user = await User.create(req.body);
      //Generate auth token
      const token = await user.generateAuthToken();
      //Generate User Wallet ID
      user.generateWallet();
      await user.save();

      // Send Welcome Message to new user

      responseHelper.createdResponse(res, "Account created succesfully", token);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        Logger.error(error);
        return res
          .status(responseStatusCodes.BAD_REQUEST)
          .json({ name: error.name, message: error.message });
      }

      next(error);
    }
  };

  static login: RequestHandler = async (req, res, next) => {
    const { email, password } = req.body as {
      email: IUser["email"];
      password: IUser["password"];
    };
    try {
      const user = await User.findByCredentials(email, password);
      //Generate auth token
      const token = await user.generateAuthToken();
      responseHelper.successResponse(res, token);
    } catch (error) {
      next(error);
    }
  };

  static getUserProfile: RequestHandler = (req, res) => {
    return responseHelper.successResponse(res, req.user);
  };

  static updateProfile: RequestHandler = async (req, res, next) => {
    try {
      const updates = Object.keys(req.body);
      if (updates.length === 0)
        throw new AppError({
          message: "Invalid update!",
          statusCode: responseStatusCodes.BAD_REQUEST,
        });
      const allowedUpdates = ["firstName", "lastName", "email", "phoneNumber"];
      const isValidOperation = updates.every((update) =>
        allowedUpdates.includes(update)
      );
      if (!isValidOperation)
        throw new AppError({
          message: "Invalid update",
          statusCode: responseStatusCodes.BAD_REQUEST,
        });
      const user: any = req.user;
      updates.forEach((update) => (user[update] = req.body[update]));
      await user.save();
      responseHelper.successResponse(res, "Profile updated successfully✅");
    } catch (error) {
      next(error);
    }
  };

  static logout: RequestHandler = async (req, res, next) => {
    const user = req.user;
    //Check through the user tokens to filter out the one that was used for auth on the device
    user.tokens = user.tokens.filter((token: any) => token.token !== req.token);
    try {
      await user.save();
      responseHelper.successResponse(
        res,
        "You've successfully logged out of this system"
      );
    } catch (error) {
      next(error);
    }
  };

  static forgetPassword: RequestHandler = async (req, res, next) => {
    const { email } = req.body as { email: IUser["email"] };
    try {
      // Check if user exist
      const user = await User.findOne({ email });
      if (!user)
        throw new AppError({
          message: "Sorry, we don't recognize this account",
          statusCode: responseStatusCodes.BAD_REQUEST,
        });

      //Generate reset Password Token
      const resetToken = await user.generateResetPasswordToken();
      // Create reset url
      const resetURl = `${req.protocol}://${req.get(
        "host"
      )}/forget_password/${resetToken}`;
      //Create mail message
      const message = `Hi ${user.firstName} \n 
    Please click on the following link ${resetURl} to reset your password. \n\n 
    If you did not request this, please disregard this email and no action will be taken.\n`;

      // Send reset URL to user via Mail

      return responseHelper.successResponse(res, "Email Sent ✅");
    } catch (error) {
      next(error);
    }
  };

  static resetPassword: RequestHandler = async (req, res, next) => {
    const { token } = req.params;

    // Hash token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    try {
      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user)
        throw new AppError({
          message: "Invalid or Expired Token",
          statusCode: responseStatusCodes.BAD_REQUEST,
        });
      // Set new password
      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save();

      return responseHelper.successResponse(res, "Password reset successfuly");
    } catch (error) {
      next(error);
    }
  };

  static deleteProfile: RequestHandler = async (req, res, next) => {
    const user = req.user;
    try {
      await user.deleteOne();
      return responseHelper.successResponse(
        res,
        "Account deactivated successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
