import { RequestHandler } from "express";
import {
  ITransaction,
  responseStatusCodes,
  TransactionType,
  TransactionStatus,
  TransactionQueryParams,
} from "../library/interfaces";
import User from "../models/users";
import Transaction from "../models/transactions";
import { responseHelper } from "../library/responseHelper";
import AppError from "../library/errorClass";
import validObjectId from "../library/valid-id";
import { FilterQuery } from "mongoose";

export default class Controller {
  static fundWallet: RequestHandler = async (req, res, next) => {
    const { amount } = req.body as { amount: ITransaction["amount"] };
    const user = req.user;
    const sender_id = user._id;
    //Zero naira charge if funding wallet
    const transaction_fee = amount * 0;
    try {
      //Update user account balance
      const balance_before = user.balance;
      user.balance = balance_before + Number(amount);
      user.save();

      //Create Transaction document
      await Transaction.create({
        sender_id,
        amount,
        transactionType: TransactionType.CREDIT,
        transaction_fee,
        transactionStatus: TransactionStatus.SUCCESS,
        balance_before,
        newBalance: user.balance,
        recipient_wallet: user.wallet,
        description: `Hi ${user.firstName}, your wallet have been funded with #${amount}.`,
      });

      return responseHelper.successResponse(
        res,
        "Wallet funded successfully ✅"
      );
    } catch (error) {
      next(error);
    }
  };

  //Transfer funds from authenticated user wallet to another user
  static transferFunds: RequestHandler = async (req, res, next) => {
    const { amount, recipient_wallet } = req.body as {
      amount: ITransaction["amount"];
      recipient_wallet: ITransaction["recipient_wallet"];
    };
    const sender = req.user;
    //Charges: 1% of the amount to be transferred
    const transaction_fee = amount * 0.01;
    const balance_before = sender.balance;
    const new_balance = balance_before - (amount + transaction_fee);

    try {
      //Prevent User from transfering funds to oneself
      if (sender.wallet === recipient_wallet)
        throw new AppError({
          message: "Cannot transfer to your own account ⛔",
          statusCode: responseStatusCodes.UNPROCESSABLE,
        });
      //Check if there is an account with the wallet
      const recipient = await User.findOne({ wallet: recipient_wallet });
      if (!recipient)
        throw new AppError({
          message: "Account verification failed. Recipient not found",
          statusCode: responseStatusCodes.NOT_FOUND,
        });
      if (balance_before < amount + transaction_fee)
        throw new AppError({
          message: `Insufficient funds`,
          statusCode: responseStatusCodes.UNPROCESSABLE,
        });

      const transaction = await Transaction.create({
        sender_id: sender._id,
        amount,
        transactionType: TransactionType.DEBIT,
        transaction_fee,
        transactionStatus: TransactionStatus.SUCCESS,
        balance_before,
        new_balance,
        recipient_wallet,
        description: `Transfer of #${amount} to ${recipient.firstName}`,
      });
      //Update sender and recipient account balance
      sender.balance = new_balance;
      recipient.balance += amount;
      await sender.save();
      await recipient.save();
      //Send Success response to User
      const Data = {
        status: "SUCCESS",
        Transfer: `-#${amount}`,
        accountNumber: recipient_wallet,
        accountName: `${recipient.firstName} ${recipient.lastName}`,
        VAT: transaction_fee,
        transactionId: transaction._id.toString(),
        Description: `You have successfully credited ${recipient.firstName}`,
      };
      return responseHelper.transactionSuccessResponse(res, Data);
    } catch (error) {
      next(error);
    }
  };

  //A User can Withdrawl funds from thier own account
  static withdrawFunds: RequestHandler = async (req, res, next) => {
    const { amount } = req.body as { amount: ITransaction["amount"] };
    const user = req.user;

    //Charges: 1% of the amount to be withdrawn
    const transaction_fee = amount * 0.01;
    const balance_before = user.balance;
    const new_balance = balance_before - (amount + transaction_fee);

    try {
      if (balance_before < amount)
        throw new AppError({
          message: `Insufficient funds in your wallet. Please topUp`,
          statusCode: responseStatusCodes.UNPROCESSABLE,
        });

      await Transaction.create({
        sender_id: user._id,
        amount,
        transactionType: TransactionType.DEBIT,
        transaction_fee,
        transactionStatus: TransactionStatus.SUCCESS,
        balance_before,
        new_balance,
        recipient_wallet: user.wallet,
        description: `${user.firstName}, your wallet have been debited with #${amount}.`,
      });
      //Update user account balance
      user.balance = new_balance;
      await user.save();

      return responseHelper.successResponse(
        res,
        "Funds withdrawn successfully from your wallet"
      );
    } catch (error) {
      next(error);
    }
  };

  // A user can view their account balance.
  static viewBalance: RequestHandler = (req, res) => {
    const balance = req.user.balance;
    return responseHelper.successResponse(res, `Your balance is #${balance}`);
  };

  // A USER CAN VIEW THEIR TRANSACTION HISTORY.

  //GET /transactions?transactionType=debit     ======>>>>> FILTER
  //GET /transactions?limit=2&skip=2             ======>>>>> PAGINATION
  //GET /transactions?sortBy=createdAt:desc      ======>>>>> SORT
  static viewTransactions: RequestHandler<{}, {}, {}, TransactionQueryParams> =
    async (req, res, next) => {
      const match: FilterQuery<ITransaction> = {};
      const sort: { [key: string]: 1 | -1 } = {};
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Filtering
      if (req.query.transactionType) {
        match.transactionType = req.query.transactionType as TransactionType;
      }
      if (req.query.transactionStatus) {
        match.transactionStatus = req.query
          .transactionStatus as TransactionStatus;
      }
      if (req.query.wallet) {
        match.$or = [
          { recipient_wallet: req.query.wallet as string },
          { "sender.wallet": req.query.wallet as string },
        ];
      }
      if (req.query.transactionId) {
        match._id = req.query.transactionId as string;
      }

      // Date range filtering
      if (req.query.startDate && req.query.endDate) {
        match.createdAt = {
          $gte: new Date(req.query.startDate as string),
          $lte: new Date(req.query.endDate as string),
        };
      }

      // Sorting
      if (req.query.sortBy) {
        const parts = (req.query.sortBy as string).split(":");
        sort[parts[0]] = parts[1] === "desc" ? -1 : 1;
      } else {
        // Default sort by latest
        sort.createdAt = -1;
      }

      try {
        const totalTransactions = await Transaction.countDocuments({
          sender_id: req.user._id,
          ...match,
        });
        const totalPages = Math.ceil(totalTransactions / limit);
        const transactions = await Transaction.find({
          sender_id: req.user._id,
          ...match,
        })
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate("sender_id", "firstName lastName wallet")
          .lean();

        if (transactions.length === 0) {
          throw new AppError({
            message: "No transaction records found",
            statusCode: responseStatusCodes.NOT_FOUND,
          });
        }

        const responseData = {
          transactions,
          currentPage: page,
          totalPages,
          totalTransactions,
          limit,
        };

        return responseHelper.successResponse(res, responseData);
      } catch (error) {
        next(error);
      }
    };

  // The user can view the details of a specific transaction id.
  static getTransactionById: RequestHandler = async (req, res, next) => {
    const { transactionId } = req.params;

    try {
      //Check Validity of transaction Id
      if (!validObjectId(transactionId))
        throw new AppError({
          message: "Invalid Input, Please check details",
          statusCode: responseStatusCodes.BAD_REQUEST,
          name: "ValidationError",
        });
      const transaction = await Transaction.findOne({ _id: transactionId });

      if (!transaction)
        throw new AppError({
          message: "No Transaction found",
          statusCode: responseStatusCodes.NOT_FOUND,
        });

      return responseHelper.successResponse(res, transaction);
    } catch (error) {
      next(error);
    }
  };

  static getTransactionStats: RequestHandler = async (req, res, next) => {
    try {
      const userId = req.user._id;
      const stats = await Transaction.aggregate([
        { $match: { sender_id: userId } },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalCredit: {
              $sum: {
                $cond: [
                  { $eq: ["$transactionType", TransactionType.CREDIT] },
                  "$amount",
                  0,
                ],
              },
            },
            totalDebit: {
              $sum: {
                $cond: [
                  { $eq: ["$transactionType", TransactionType.DEBIT] },
                  "$amount",
                  0,
                ],
              },
            },
            avgTransactionAmount: { $avg: "$amount" },
          },
        },
      ]);

      return responseHelper.successResponse(res, stats[0] || {});
    } catch (error) {
      next(error);
    }
  };

  //   static getMonthlyTransactionSummary: RequestHandler = async (
  //     req,
  //     res,
  //     next
  //   ) => {
  //     try {
  //       const userId = req.user._id;
  //       const summary = await Transaction.aggregate([
  //         { $match: { sender_id: userId } },
  //         {
  //           $group: {
  //             _id: {
  //               year: { $year: "$createdAt" },
  //               month: { $month: "$createdAt" },
  //             },
  //             totalTransactions: { $sum: 1 },
  //             totalCredit: {
  //               $sum: {
  //                 $cond: [
  //                   { $eq: ["$transactionType", TransactionType.CREDIT] },
  //                   "$amount",
  //                   0,
  //                 ],
  //               },
  //             },
  //             totalDebit: {
  //               $sum: {
  //                 $cond: [
  //                   { $eq: ["$transactionType", TransactionType.DEBIT] },
  //                   "$amount",
  //                   0,
  //                 ],
  //               },
  //             },
  //           },
  //         },
  //         { $sort: { "_id.year": -1, "_id.month": -1 } },
  //       ]);

  //       return responseHelper.successResponse(res, summary);
  //     } catch (error) {
  //       next(error);
  //     }
  //   };

  static totalAmountCredited: RequestHandler = async (req, res, next) => {
    try {
      //Get all transactions made by the user
      await req.user?.populate({
        path: "transactions",
        match: { transactionType: TransactionType.CREDIT },
      });
      const transactions = req.user?.transactions;
      //Sum up all credit amount
      let totalcredit = 0;
      transactions?.forEach(
        (transaction) => (totalcredit += transaction.amount)
      );
      return responseHelper.successResponse(
        res,
        `Total amount credited is #${totalcredit}`
      );
    } catch (error) {
      next(error);
    }
  };

  static totalAmountDebited: RequestHandler = async (req, res, next) => {
    try {
      //Get all transactions made by the user
      await req.user.populate({
        path: "transactions",
        match: { transactionType: TransactionType.DEBIT },
      });
      const transactions = req.user.transactions;
      //Sum up the debit amount
      let totalDebit = 0;
      transactions?.forEach(
        (transaction) => (totalDebit += transaction.amount)
      );
      return responseHelper.successResponse(
        res,
        `The total amount debited is #${totalDebit}`
      );
    } catch (error) {
      next(error);
    }
  };
}
