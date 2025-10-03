import { Application, Router } from "express";
import TransactionController from "../controllers/transactions";
import joiSchema from "../library/joi-schema";
import validator from "../middleware/validator";
import auth from "../middleware/auth";

class TransactionRoutes {
  public router: Router;
  constructor() {
    this.router = Router();
    this.registeredRoutes();
  }
  private registeredRoutes() {
    //Every routes below will require authentication
    this.router.use(auth);
    this.router.post(
      "/fund-wallet",
      validator(joiSchema.fundWallet, "body"),
      TransactionController.fundWallet
    );
    this.router.post(
      "/",
      validator(joiSchema.transferFunds, "body"),
      TransactionController.transferFunds
    );
    this.router.get("/balance", TransactionController.viewBalance);
    this.router.post(
      "/withdrawal",
      validator(joiSchema.withdrawFunds, "body"),
      TransactionController.withdrawFunds
    );
    this.router.get("/", TransactionController.viewTransactions);
    this.router.get(
      "/:transactionId",
      TransactionController.getTransactionById
    );

    this.router.get(
      "/summary/statistics",
      TransactionController.getTransactionStats
    );

    // this.router.get(
    //   "/reports",
    //   TransactionController.getMonthlyTransactionSummary
    // );
    this.router.get(
      "/summary/credited",
      TransactionController.totalAmountCredited
    );
    this.router.get(
      "/summary/debited",
      TransactionController.totalAmountDebited
    );
  }
}

//Register transaction routes in App
const transactionRouter = (app: Application) => {
  app.use("/transactions", new TransactionRoutes().router);
};

export default transactionRouter;
