import type { MetadataRoute } from "next";

const base =
	process.env.NEXT_PUBLIC_APP_URL ?? "https://codesheriff.amaanurraheman.qzz.io";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [{ userAgent: "*", allow: "/" }],
		sitemap: `${base}/sitemap.xml`,
	};
}
