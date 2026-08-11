import type { Metadata } from "next";
import DeviceVerifyClient from "./device-verify-client";

export const metadata: Metadata = {
	title: "Connect a Device",
	description:
		"Enter the code shown on your terminal to authorize the Code Sheriff CLI.",
};

export default function DeviceVerificationPage() {
	return <DeviceVerifyClient />;
}
