"use client";

import { ProfileForm } from "@/modules/settings/components/profile-form";
import { RepositoryList } from "@/modules/settings/components/repository-list";
import { ApiKeysManager } from "@/modules/settings/components/api-keys-manager";
import { EmailNotifications } from "@/modules/settings/components/email-notifications";
import { PageHeader } from "@/components/page-header";

const SettingsPageClient = () => {
	return (
		<div className="space-y-6">
			<PageHeader
				kicker="Account"
				title="Settings"
				description="Manage your account settings and connected repositories."
			/>
            
            <ProfileForm />

            <EmailNotifications />
            
            <RepositoryList />

            <ApiKeysManager />
		</div>
	);
};

export default SettingsPageClient;
