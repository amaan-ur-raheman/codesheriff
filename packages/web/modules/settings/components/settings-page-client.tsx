"use client";

import { ProfileForm } from "@/modules/settings/components/profile-form";
import { RepositoryList } from "@/modules/settings/components/repository-list";
import { ApiKeysManager } from "@/modules/settings/components/api-keys-manager";

const SettingsPageClient = () => {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Settings</h1>
				<p className="text-muted-foreground">
					Manage your account settings and connected repositories.
				</p>
			</div>
            
            <ProfileForm />
            
            <RepositoryList />

            <ApiKeysManager />
		</div>
	);
};

export default SettingsPageClient;
