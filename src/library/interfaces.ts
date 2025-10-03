import { HydratedDocument, Model, Document, Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      user: UserDocument;
      token?: string;
    }
  }
}

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  avatar: Buffer | undefined;
  balance: number;
  wallet: string;
  tokens: object[];
  is_admin: boolean;
  resetPasswordToken: string | undefined;
  resetPasswordExpire: Date | undefined;
  transactions?: ITransaction[];
}

export interface ITransaction {
  sender_id: Types.ObjectId;
  transactionType: TransactionType;
  transactionStatus?: TransactionStatus;
  recipient_wallet: string;
  amount: number;
  transaction_fee?: number;
  balance_before: number;
  new_balance: number;
  description?: string;
}

export type TransactionQueryParams = {
  page?: string;
  limit?: string;
  transactionType?: TransactionType;
  transactionStatus?: TransactionStatus;
  wallet?: string;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
};

export enum TransactionType {
  CREDIT = "credit",
  DEBIT = "debit",
}

export enum TransactionStatus {
  SUCCESS = "success",
  FAILURE = "failed",
  PENDING = "pending",
}
export type IMatch = {
  transactionType: TransactionType;
  transactionStatus: TransactionStatus;
  wallet: string;
  transactionId: string;
  createdAt: Date;
};

export type UserDocument = IUser & Document;

export interface IUserMethods {
  transactions?: ITransaction[];
  generateAuthToken(): Promise<string>;
  generateWallet(): string;
  generateResetPasswordToken(): Promise<string>;
}

export interface UserModel extends Model<IUser, object, IUserMethods> {
  findByCredentials(
    email: string,
    password: string
  ): Promise<HydratedDocument<IUser, IUserMethods>>;
}

export type Data = object | string;

export interface ILogin {
  email: string;
  password: string;
}

export interface IDecode {
  _id: string;
}

export interface AppErrorArgs {
  name?: string;
  message: string;
  statusCode: responseStatusCodes;
  isOperational?: boolean;
}

export enum responseStatusCodes {
  SUCCESS = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  MODIFIED = 304,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE = 422,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
}
