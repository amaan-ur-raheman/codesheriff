import type { MetadataRoute } from "next";

const base = new URL(
	process.env.NEXT_PUBLIC_APP_URL ?? "https://codesheriff.amaanurraheman.qzz.io"
).origin;

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: base,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
	];
}
