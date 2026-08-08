import {
	SidebarProvider,
	SidebarTrigger,
	SidebarInset,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/modules/search/components/command-palette";
import { ReviewStatusTracker } from "@/modules/review/components/review-status-tracker";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";

import { requireAuth } from "@/modules/auth/utils/auth-utils";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
	await requireAuth();

	return (
		<SidebarProvider defaultOpen={true}>
			<AppSidebar />
			<SidebarInset>
				<CommandPalette />
				<ReviewStatusTracker />
				<header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mx-2 h-4" />
					<h1 className="font-display text-lg tracking-tight text-foreground">
						Dashboard
					</h1>
					<div className="ml-auto">
						<NotificationBell />
					</div>
				</header>
				<main className="flex-1 overflow-auto p-6 md:p-8">
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default DashboardLayout;
