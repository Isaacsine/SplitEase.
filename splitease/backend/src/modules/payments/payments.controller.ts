import type { Request, Response } from "express";
import { parseCreatePayment } from "./payments.schema.js";
import { PaymentsService } from "./payments.service.js";
export function createPaymentsController(service: PaymentsService) { return {
  create: async (req: Request, res: Response) => { try { const payment = await service.create(parseCreatePayment(req.body), req.header("Idempotency-Key")); res.status(201).json({ payment, simulated: true }); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid payment request." }); } },
  get: async (req: Request, res: Response) => { const id = String(req.params.id); const payment = await service.get(id); return payment ? res.json({ payment, simulated: true }) : res.status(404).json({ error: "Payment not found." }); },
  refund: async (req: Request, res: Response) => { try { const payment = await service.refund(String(req.params.id)); return payment ? res.json({ payment, simulated: true }) : res.status(404).json({ error: "Payment not found." }); } catch (error) { return res.status(409).json({ error: error instanceof Error ? error.message : "Could not refund payment." }); } },
}; }
