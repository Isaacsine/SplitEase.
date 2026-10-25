import { Router } from "express";
import { PaymentsService } from "./payments.service.js";
import { createPaymentsController } from "./payments.controller.js";
import { readEnv } from "../../config/env.js";
import { createPaymentRepository } from "./payments.repository.js";
export function paymentsRoutes(service?: PaymentsService) { const router = Router(), controller = createPaymentsController(service || new PaymentsService(createPaymentRepository(readEnv()))); router.post("/", controller.create); router.post("/checkout", controller.create); router.get("/:id", controller.get); router.post("/:id/refund", controller.refund); return router; }
