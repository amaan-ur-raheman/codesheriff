"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../actions";

export function NotificationBell() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);

	const { data: unreadCount = 0 } = useQuery({
		queryKey: ["notifications", "unread-count"],
		queryFn: getUnreadCount,
		refetchInterval: 30000,
	});

	const { data: notifications = [] } = useQuery({
		queryKey: ["notifications"],
		queryFn: () => getNotifications(10),
		enabled: open,
	});

	const markReadMutation = useMutation({
		mutationFn: markAsRead,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
		},
	});

	const markAllReadMutation = useMutation({
		mutationFn: markAllAsRead,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
		},
	});

	const formatTime = (date: string | Date) => {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		return `${diffDays}d ago`;
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" className="relative">
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<Badge
							variant="destructive"
							className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold rounded-full"
						>
							{unreadCount > 99 ? "99+" : unreadCount}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="end">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h4 className="font-semibold text-sm">Notifications</h4>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs"
							onClick={() => markAllReadMutation.mutate()}
						>
							Mark all read
						</Button>
					)}
				</div>
				<ScrollArea className="h-80">
					{notifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
							<Bell className="h-8 w-8 mb-2 opacity-50" />
							<p className="text-sm">No notifications yet</p>
						</div>
					) : (
						<div className="divide-y">
							{notifications.map((n) => (
								<button
									key={n.id}
									className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
										!n.read ? "bg-accent/20" : ""
									}`}
									onClick={() => {
										if (!n.read) {
											markReadMutation.mutate(n.id);
										}
									}}
								>
									<div className="flex items-start gap-3">
										{!n.read && (
											<span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
										)}
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium leading-none">
												{n.title}
											</p>
											<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
												{n.message}
											</p>
											<p className="text-[10px] text-muted-foreground mt-1.5">
												{formatTime(n.createdAt)}
											</p>
										</div>
									</div>
								</button>
							))}
						</div>
					)}
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}
