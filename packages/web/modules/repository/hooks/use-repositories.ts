"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRepositories } from "../actions";

/**
 * Numbered pagination over the user's GitHub repositories (server-side via
 * the fetchRepositories action). Exposes the current page's items plus
 * `page` / `goToPage` / `totalPages` for the shared numbered Pagination
 * control.
 *
 * placeholderData keeps the previous page's items rendered while the next
 * page is fetched, so page changes don't flash a skeleton.
 */
export const useRepositories = (pageSize: number = 10) => {
	const [page, setPage] = useState(1);

	const query = useQuery({
		queryKey: ["repositories", page, pageSize],
		queryFn: async () => await fetchRepositories(page, pageSize),
		placeholderData: (prev) => prev,
	});

	// The server reports the true page count from rel="last". Before the
	// first response lands, fall back to the current page so the pager stays
	// hidden until we know how many exist.
	const totalPages = query.data?.totalPages ?? page;

	// If a request overshot the last page (repo count shrank while deep in
	// the list), snap the pager back to the reported last page instead of
	// leaving the user stranded on an empty page.
	useEffect(() => {
		if (query.data && page > totalPages && totalPages >= 1) {
			setPage(totalPages);
		}
	}, [query.data, page, totalPages]);

	return {
		...query,
		data: query.data?.items ?? [],
		totalPages,
		page,
		goToPage: setPage,
	};
};
