/**
 * Main application sidebar component providing navigation and user controls
 *
 * Editorial Paper treatment: serif wordmark, mono connected-account row,
 * paper wash for the active item, quiet footer.
 *
 * @component
 */
"use client";

import {
	Github,
	BookOpen,
	Settings,
	LogOut,
	Star,
	Crown,
	Users,
	Shield,
	Plug,
} from "lucide-react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarGroup,
	SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import Link from "next/link";

import Logout from "@/modules/auth/components/logout";
import { useSession } from "@/lib/auth-client";
import { ThemeMenu } from "@/components/ui/theme-menu";

export const AppSidebar = () => {
	const [mounted, setMounted] = useState(false);
	const pathname = usePathname();
	const { data: session } = useSession();

	useEffect(() => {
		setMounted(true);
	}, []);

	const isActive = (url: string) => {
		if (url === "/dashboard") {
			return pathname === "/dashboard";
		}
		return pathname === url || pathname.startsWith(url + "/");
	};

	if (!mounted || !session) return null;

	const user = session.user as Record<string, unknown> & { name?: string; email?: string; image?: string; role?: string };

	const navigationItems = [
		{
			title: "Dashboard",
			url: "/dashboard",
			icon: BookOpen,
		},
		{
			title: "Repository",
			url: "/dashboard/repository",
			icon: Github,
		},
		{
			title: "Reviews",
			url: "/dashboard/reviews",
			icon: Star,
		},
		{
			title: "Teams",
			url: "/dashboard/organizations",
			icon: Users,
		},
		{
			title: "Subscriptions",
			url: "/dashboard/subscriptions",
			icon: Crown,
		},
		{
			title: "Integrations",
			url: "/dashboard/integrations",
			icon: Plug,
		},
		{
			title: "Settings",
			url: "/dashboard/settings",
			icon: Settings,
		},
		...(user?.role === "admin"
			? [
					{
						title: "Admin",
						url: "/dashboard/admin",
						icon: Shield,
					},
				]
			: []),
	];
	const userName = user.name || "GUEST";
	const userEmail = user.email || "";
	const userAvatar = user.image || "";
	const userInitials = (userName as string)
		.split(" ")
		.map((s) => s[0])
		.join("")
		.toUpperCase();

	return (
		<Sidebar>
			<SidebarHeader className="border-b border-sidebar-border">
				<div className="flex flex-col gap-5 px-4 py-6">
					<div className="flex items-center gap-2.5 font-display text-lg tracking-tight text-sidebar-foreground">
						<div className="relative w-7 h-7 flex items-center justify-center shrink-0">
							<Image src="/logo-32.png" alt="Code Sheriff Logo" width={32} height={32} className="object-contain w-full h-full" />
						</div>
						<span>CodeSheriff</span>
					</div>						<div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
							<div className="flex items-center justify-center w-9 h-9 border border-sidebar-border bg-sidebar-accent text-sidebar-foreground shrink-0">
								<Github className="w-4 h-4" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
									Connected account
								</p>
								<p className="font-mono text-xs text-sidebar-foreground truncate mt-0.5">
									@{userName}
								</p>
							</div>
						</div>
				</div>
			</SidebarHeader>

			<SidebarContent className="px-3 py-6">
				<SidebarGroup>
					<SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground h-6 px-4">
						Navigate
					</SidebarGroupLabel>
					<SidebarMenu className="gap-1 mt-2">
						{navigationItems.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									asChild
									tooltip={item.title}
									isActive={isActive(item.url)}
									className={`h-11 px-4 transition-colors duration-150 ${
										isActive(item.url)
											? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
											: "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
									}`}
								>
									<Link
										href={item.url}
										className="flex items-center gap-3"
									>
										<item.icon className="w-5 h-5 flex shrink-0" />
										<span className="text-sm">
											{item.title}
										</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-t border-sidebar-border px-3 py-4">
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size={"lg"}
									className="h-12 px-3 hover:bg-sidebar-accent/50 data-[state=open]:bg-sidebar-accent/60 transition-colors"
								>
									<Avatar className="w-10 h-10 shrink-0">
										<AvatarImage
											src={
												userAvatar || "/placeholder.svg"
											}
											alt={userName}
										/>
										<AvatarFallback>
											{userInitials}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm min-w-0">
										<span className="truncate font-medium text-sidebar-foreground">
											{userName}
										</span>
										<span className="truncate font-mono text-[11px] text-muted-foreground">
											{userEmail}
										</span>
									</div>
								</SidebarMenuButton>
							</DropdownMenuTrigger>

							<DropdownMenuContent
								className="w-80"
								align="end"
								side="right"
								sideOffset={8}
							>
								<div className="flex items-center gap-3 px-4 py-4 border-b border-border">
									<Avatar className="w-12 h-12 shrink-0">
										<AvatarImage
											src={
												userAvatar || "/placeholder.svg"
											}
											alt={userName}
										/>
										<AvatarFallback>
											{userInitials}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm">
											{userName}
										</p>
										<p className="font-mono text-xs text-muted-foreground truncate">
											{userEmail}
										</p>
									</div>
								</div>

								<div className="px-2 py-3">
									<ThemeMenu />
									<DropdownMenuItem className="cursor-pointer px-3 py-3 my-1 hover:bg-destructive/10 hover:text-destructive transition-colors font-medium">
										<LogOut className="w-5 h-5 mr-3 shrink-0" />
										<Logout>
											Sign Out
										</Logout>
									</DropdownMenuItem>
								</div>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
};
