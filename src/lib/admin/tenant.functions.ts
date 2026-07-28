import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setActiveTenantForUser } from "./tenant.server";

export const setActiveTenant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        restaurantId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => setActiveTenantForUser(data));
