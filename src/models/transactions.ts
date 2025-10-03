import { model, Schema } from "mongoose";
import {
  ITransaction,
  TransactionStatus,
  TransactionType,
} from "../library/interfaces";

const TransactionSchema = new Schema<ITransaction>(
  {
    sender_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    transactionType: {
      type: String,
      enum: TransactionType,
      required: true,
    },
    transactionStatus: {
      type: String,
      enum: TransactionStatus,
      default: TransactionStatus.PENDING,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    recipient_wallet: {
      type: String,
      required: true,
    },
    transaction_fee: {
      type: Number,
      required: true,
      default: 0,
    },
    balance_before: {
      type: Number,
      required: true,
      default: 0,
    },
    new_balance: {
      type: Number,
      required: true,
      default: 0,
    },
    description: String,
  },
  { timestamps: true }
);

const Transaction = model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
