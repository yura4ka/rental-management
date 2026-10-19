import { AuthService } from "./authService";
import type { IAuthApi } from "./types";

describe("AuthService.register", () => {
  function setup() {
    const api = { signup: jest.fn() };
    const repository = { getCurrentAccount: jest.fn(), saveCurrentAccount: jest.fn() };
    const network = { isOnline: jest.fn() };
    const controller = new AbortController();
    const service = new AuthService(
      api as unknown as IAuthApi,
      repository,
      network,
      controller.signal,
    );
    return { api, repository, network, controller, service };
  }

  it("delegates signup without reading or writing the account database", async () => {
    const { api, repository, network, service } = setup();
    const input = {
      email: "person@example.com",
      password: "safe password",
      role: "Applicant" as const,
    };
    const account = { id: "account-id", email: input.email, role: input.role };
    const signal = new AbortController().signal;
    api.signup.mockResolvedValue(account);
    await expect(service.register(input, signal)).resolves.toEqual(account);
    expect(api.signup).toHaveBeenCalledWith(input, signal);
    expect(repository.getCurrentAccount).not.toHaveBeenCalled();
    expect(repository.saveCurrentAccount).not.toHaveBeenCalled();
    expect(network.isOnline).not.toHaveBeenCalled();
  });

  it("rejects an expired service scope", () => {
    const { api, controller, service } = setup();
    controller.abort();
    expect(() => service.register({ email: null, password: null, role: null })).toThrow(
      "The session is no longer active.",
    );
    expect(api.signup).not.toHaveBeenCalled();
  });
});
