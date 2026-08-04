import { z } from "zod";

const phoneRegex = /^(?:\+254|254|0)[17]\d{8}$/;

const loginSchema = z.object({
    phone: z
        .string()
        .min(1, "Phone number is required")
        .regex(phoneRegex, "Enter a valid Kenyan phone number"),

    password: z
        .string()
        .min(6, "Password must be at least 6 characters"),
});

export default loginSchema;