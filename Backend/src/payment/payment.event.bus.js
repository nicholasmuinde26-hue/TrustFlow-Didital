import { EventEmitter } from "events";

const paymentEventBus = new EventEmitter();
paymentEventBus.setMaxListeners(20); // Audit + Finance + Notification + Reporting + WS

export default paymentEventBus;
