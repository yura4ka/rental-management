export const authKeys = {
  all: ["auth"] as const,
  account: () => [...authKeys.all, "account"] as const,
  login: () => [...authKeys.all, "login"] as const,
  register: () => [...authKeys.all, "register"] as const,
};
