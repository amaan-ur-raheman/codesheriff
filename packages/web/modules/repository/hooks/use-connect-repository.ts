"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { connectRepository } from "@/modules/dashboard/actions";

export const useConnectRepository = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			owner,
			repo,
			githubId,
		}: {
			owner: string;
			repo: string;
			githubId: number;
		}) => {
			return await connectRepository(owner, repo, githubId);
		},
		onSuccess: () => {
			toast.success("Repository connected successfully!");
			queryClient.invalidateQueries({ queryKey: ["repositories"] });
			queryClient.invalidateQueries({
				queryKey: ["connected-repositories"],
			});
			queryClient.invalidateQueries({ queryKey: ["subscription-data"] });
		},
		onError: (error: any) => {
			console.error("Failed to connect repository:", error);
			toast.error("Failed to connect repository");
		},
	});
};
