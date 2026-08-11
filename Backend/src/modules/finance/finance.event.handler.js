import { PAYMENT_EVENTS } from "../../payment/payment.constants.js";
import paymentEventBus from "../../payment/events/payment.event.bus.js";
import { runPostingPipeline } from "./accounting/posting.pipeline.js";
import { getRuleForProduct } from "./accounting/rules/rule.registry.js";

export function registerFinanceEventHandlers() {
  
  paymentEventBus.on(PAYMENT_EVENTS.COMPLETED, async (event) => {
    try {
      const { payment, metadata } = event;
      const productType = payment.productType || metadata?.productType;

      if (!productType) {
        console.error(`Finance Handler: No productType on payment ${payment.id}`);
        return;
      }

      const rule = getRuleForProduct(productType);
      if (!rule) {
        console.error(`Finance Handler: No rule for productType ${productType}`);
        return;
      }

      console.log(`Finance Handler: Posting ${productType} payment ${payment.id}`);

      await runPostingPipeline({
        rule,
        context: { 
          payment,
          event, // pass full event for audit trail
          meta: metadata
        }
      });

      console.log(`Finance Handler: Posted GL for payment ${payment.id}`);

    } catch (error) {
      console.error(`Finance Handler failed for payment ${event.payment?.id}:`, error);
      // TODO: push to dead-letter queue for reconciliation job
    }
  });

  console.log("Finance Event Handlers registered");
}