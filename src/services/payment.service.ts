import { invokeFunction } from "../lib/functions";
import type { PaymentChannel } from "../types/db";

export interface PaymentResult {
  purchase_id: string;
  reference: string;
  message: string;
}

export const PaymentService = {
  /**
   * Charge the user's mobile wallet via the create-payment edge function.
   * The server creates a pending purchase, calls WaafiPay (API_PURCHASE) and
   * marks the purchase completed/failed — the client can never fake payment.
   * NOTE: the USSD confirmation can take a while; the promise resolves when
   * the user approves or rejects the charge on their phone.
   */
  createPayment(
    courseId: string,
    channel: PaymentChannel,
    phoneNumber: string
  ): Promise<PaymentResult> {
    return invokeFunction<PaymentResult>("create-payment", {
      course_id: courseId,
      payment_channel: channel,
      phone_number: phoneNumber,
    });
  },
};
