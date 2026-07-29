import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createPdvOrderRecord } from "./pdv.server";

export const createPdvOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        restaurantId: z.string().uuid(),
        cashSessionId: z.string().uuid().nullable().optional(),
        discount: z.number().nonnegative().default(0),
        payment: z.object({ kind: z.string().min(2).max(20), change: z.number().optional() }),
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              quantity: z.number().int().positive().max(99),
              optionIds: z.array(z.string().uuid()).optional(),
              note: z.string().max(200).optional(),
            }),
          )
          .min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      return await createPdvOrderRecord(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      throw new Error(msg && msg.length < 160 ? msg : "Não foi possível registrar a venda.");
    }
  });
