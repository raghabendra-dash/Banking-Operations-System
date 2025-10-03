import { Application, Router } from "express";
import userController from "../controllers/users";
import validator from "../middleware/validator";
import joiSchema from "../library/joi-schema";
import auth from "../middleware/auth";

class UserRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.registeredRoutes();
  }

  protected registeredRoutes() {
    this.router.post(
      "/signup",
      validator(joiSchema.signup, "body"),
      userController.signup
    );
    this.router.post(
      "/login",
      validator(joiSchema.login, "body"),
      userController.login
    );
    this.router.post(
      "/password/forgot",
      validator(joiSchema.forgetPassword, "body"),
      userController.forgetPassword
    );
    this.router.post(
      "/password/reset/:token",
      validator(joiSchema.resetPassword, "body"),
      userController.resetPassword
    );
    //Every routes below will require authentication
    this.router.use(auth);
    this.router.get("/profile", userController.getUserProfile);
    this.router.patch("/", userController.updateProfile);
    this.router.post("/logout", userController.logout);
    this.router.delete("/", userController.deleteProfile);
  }
}

// Register User routes in App
const userRouter = (app: Application) => {
  app.use("/users", new UserRoutes().router);
};

export default userRouter;
