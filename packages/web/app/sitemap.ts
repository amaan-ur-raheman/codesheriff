import type { MetadataRoute } from "next";

const base =
	process.env.NEXT_PUBLIC_APP_URL ?? "https://codesheriff.amaanurraheman.qzz.io";

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
