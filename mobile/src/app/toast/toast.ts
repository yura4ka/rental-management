import { createElement } from "react";
import { toast as sonnerToast } from "sonner-native";
import { Toast } from "@/components/Toast";

export const toast = {
  success: (message: string) =>
    sonnerToast.custom(createElement(Toast, { message, variant: "success" }), {
      duration: 4000,
      unstyled: true,
    }),
  error: (message: string) =>
    sonnerToast.custom(createElement(Toast, { message, variant: "error" }), {
      duration: 6000,
      unstyled: true,
    }),
};
