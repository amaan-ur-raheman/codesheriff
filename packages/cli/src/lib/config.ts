import fs from "fs";
import Conf from "conf";

interface ConfigSchema {
	token?: string;
	user?: {
		id: string;
		name: string;
		email: string;
	};
}

// Migrate old codehorse config to codesheriff if it exists
const migrateConfig = () => {
	try {
		const oldConfig = new Conf<ConfigSchema>({
			projectName: "codehorse",
			configName: "config",
		});

		if (fs.existsSync(oldConfig.path)) {
			const newConfig = new Conf<ConfigSchema>({
				projectName: "codesheriff",
				configName: "config",
			});

			const oldStore = oldConfig.store;
			if (oldStore && Object.keys(oldStore).length > 0) {
				for (const [key, value] of Object.entries(oldStore)) {
					if (value !== undefined && !newConfig.has(key)) {
						newConfig.set(key as keyof ConfigSchema, value);
					}
				}
			}
			// Delete the old config file to prevent redundant migrations and clean up
			fs.unlinkSync(oldConfig.path);
		}
	} catch (error) {
		console.error("Failed to migrate old configuration from codehorse to codesheriff:", error);
	}
};

migrateConfig();

export const config = new Conf<ConfigSchema>({
	projectName: "codesheriff",
	configName: "config",
});

export const getToken = (): string | undefined => config.get("token");
export const setToken = (token: string): void => config.set("token", token);
export const clearToken = (): void => config.delete("token");

export const getUser = () => config.get("user");
export const setUser = (user: ConfigSchema["user"]): void => config.set("user", user);
export const clearUser = (): void => config.delete("user");
