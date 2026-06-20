import Conf from "conf";

interface ConfigSchema {
	token?: string;
	user?: {
		id: string;
		name: string;
		email: string;
	};
}

export const config = new Conf<ConfigSchema>({
	projectName: "codehorse",
	configName: "config",
});

export const getToken = (): string | undefined => config.get("token");
export const setToken = (token: string): void => config.set("token", token);
export const clearToken = (): void => config.delete("token");

export const getUser = () => config.get("user");
export const setUser = (user: ConfigSchema["user"]): void => config.set("user", user);
export const clearUser = (): void => config.delete("user");
