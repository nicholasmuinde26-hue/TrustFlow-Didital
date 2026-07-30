import { z } from "zod";

const loginSchema = z.object({
  phone: z
    .string()
    .regex(
      /^(?:\+254|254|0)(7|1)\d{8}$/,
      "Enter a valid Kenyan phone number"
    ),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

export default loginSchema;