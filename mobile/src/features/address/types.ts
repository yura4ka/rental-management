import type { z } from "zod";
import type { addressFormSchema, addressSchema } from "./schemas";

export type Address = z.infer<typeof addressSchema>;
export type AddressInput = z.infer<typeof addressFormSchema>;
