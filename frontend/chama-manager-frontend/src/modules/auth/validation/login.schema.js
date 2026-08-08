import { z } from "zod";

// Matches the backend's validation exactly (auth.service.js):
// Kenyan phone, 07XXXXXXXX or 2547XXXXXXXX, password min 8 chars.
const loginSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^(0|254)\d{9}$/, "Use 07XXXXXXXX or 2547XXXXXXXX"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export default loginSchema;