"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings } from "lucide-react";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { getReviewConfig, updateReviewConfig } from "../actions/review-config";

const FOCUS_AREAS = [
	{ id: "security", label: "Security" },
	{ id: "performance", label: "Performance" },
	{ id: "readability", label: "Readability" },
	{ id: "maintainability", label: "Maintainability" },
	{ id: "testing", label: "Testing" },
	{ id: "architecture", label: "Architecture" },
] as const;

interface ReviewConfigDialogProps {
	repositoryId: string;
}

export function ReviewConfigDialog({ repositoryId }: ReviewConfigDialogProps) {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data: config, isLoading } = useQuery({
		queryKey: ["review-config", repositoryId],
		queryFn: () => getReviewConfig(repositoryId),
		enabled: open,
	});

	const [focusAreas, setFocusAreas] = useState<string[]>([
		"security",
		"performance",
		"readability",
		"maintainability",
	]);
	const [minSeverity, setMinSeverity] = useState("warning");
	const [autoReview, setAutoReview] = useState(true);
	const [customPrompt, setCustomPrompt] = useState("");

	useEffect(() => {
		if (config) {
			setFocusAreas((config.focusAreas as string[]) || []);
			setMinSeverity(config.minSeverity);
			setAutoReview(config.autoReview);
			setCustomPrompt(config.customPrompt || "");
		}
	}, [config]);

	const { mutate: saveConfig, isPending } = useMutation({
		mutationFn: () =>
			updateReviewConfig(repositoryId, {
				focusAreas,
				minSeverity,
				autoReview,
				customPrompt: customPrompt || undefined,
			}),
		onSuccess: () => {
			toast.success("Review configuration saved");
			queryClient.invalidateQueries({
				queryKey: ["review-config", repositoryId],
			});
			setOpen(false);
		},
		onError: () => {
			toast.error("Failed to save configuration");
		},
	});

	const toggleFocusArea = (area: string) => {
		setFocusAreas((prev) =>
			prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
		);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Settings className="mr-2 h-4 w-4" />
					Configure
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Review Configuration</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<div className="flex justify-center py-8">
						<Spinner />
					</div>
				) : (
					<div className="space-y-6 py-2">
						<div className="space-y-3">
							<Label>Focus Areas</Label>
							<div className="grid grid-cols-2 gap-3">
								{FOCUS_AREAS.map((area) => (
									<div
										key={area.id}
										className="flex items-center gap-2"
									>
										<Checkbox
											id={area.id}
											checked={focusAreas.includes(area.id)}
											onCheckedChange={() => toggleFocusArea(area.id)}
										/>
										<Label
											htmlFor={area.id}
											className="font-normal cursor-pointer"
										>
											{area.label}
										</Label>
									</div>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<Label>Minimum Severity</Label>
							<Select value={minSeverity} onValueChange={setMinSeverity}>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="error">Error</SelectItem>
									<SelectItem value="warning">Warning</SelectItem>
									<SelectItem value="info">Info</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label>Auto Review</Label>
								<p className="text-xs text-muted-foreground">
									Automatically review new pull requests
								</p>
							</div>
							<Switch
								checked={autoReview}
								onCheckedChange={setAutoReview}
							/>
						</div>

						<div className="space-y-2">
							<Label>Custom Prompt (Advanced)</Label>
							<Textarea
								placeholder="Optional custom instructions for the AI reviewer..."
								value={customPrompt}
								onChange={(e) => setCustomPrompt(e.target.value)}
								rows={4}
							/>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={() => saveConfig()}
						disabled={isPending || isLoading}
					>
						{isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
