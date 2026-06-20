/**
 * Prisma Client Instance
 *
 * This file configures and exports a singleton instance of the Prisma Client.
 * It uses the `@prisma/adapter-pg` driver for PostgreSQL serverless environments (if applicable).
 *
 * In development, the instance is attached to `globalThis` to prevent multiple connections
 * during hot-reloads.
 */

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL,
});

const prismaClientSingleton = () => {
	return new PrismaClient({
		adapter,
	});
};

declare const globalThis: {
	prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal || prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
	globalThis.prismaGlobal = prisma;
}

export default prisma;
