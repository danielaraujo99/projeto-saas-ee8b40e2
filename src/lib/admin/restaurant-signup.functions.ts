import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createRestaurantForCustomUser } from "./restaurant-signup.server";

export const createRestaurantSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        ownerName: z.string().min(1).max(120),
        name: z.string().min(1).max(160),
        slug: z.string().min(1).max(120),
        category: z.string().min(1).max(80),
        phone: z.string().min(10).max(32),
      })
      .parse(input),
  )
  .handler(async ({ data }) => createRestaurantForCustomUser(data));