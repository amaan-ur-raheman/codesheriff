"use client";

import { useEffect, useMemo } from "react";
import { Handle, Position, useNodesState, useEdgesState } from "@xyflow/react";
import { Canvas } from "@/components/ai-elements/canvas";
import { Badge } from "@/components/ui/badge";
import { parseSuggestionsFromReview } from "@/modules/ai/lib/suggestions";
import { FileCode2, Check, AlertCircle } from "lucide-react";

// PR Node Component
const PRNode = ({ data }: any) => (
	<div className="p-4 rounded-xl border-2 border-primary/50 bg-card/90 shadow-lg min-w-[200px] text-center backdrop-blur-md">
		<Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-primary" />
		<div className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Pull Request</div>
		<div className="font-semibold text-sm max-w-[180px] truncate mx-auto">{data.title}</div>
		<div className="text-xs text-muted-foreground mt-0.5">#{data.prNumber}</div>
	</div>
);

// File Node Component
const FileNode = ({ data }: any) => (
	<div className="p-3 rounded-lg border border-border bg-card/90 shadow-sm min-w-[220px] text-left">
		<Handle type="target" position={Position.Top} className="w-2 h-2" />
		<Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-muted-foreground" />
		<div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Modified File</div>
		<div className="font-mono text-xs truncate max-w-[190px] flex items-center gap-1">
			<FileCode2 className="h-3 w-3 shrink-0" />
			{data.filePath}
		</div>
		<div className="flex items-center gap-1.5 mt-2">
			<Badge variant="secondary" className="text-[9px] py-0 h-4">
				{data.suggestionCount} issue{data.suggestionCount !== 1 && "s"}
			</Badge>
		</div>
	</div>
);

// Suggestion Node Component
const SuggestionNode = ({ data }: any) => {
	const severityColors: any = {
		error: "border-red-500/50 bg-red-500/5 text-red-700 dark:text-red-400",
		warning: "border-yellow-500/50 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400",
		info: "border-blue-500/50 bg-blue-500/5 text-blue-700 dark:text-blue-400",
		suggestion: "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
	};

	return (
		<div className={`p-3 rounded-lg border-2 shadow-md min-w-[260px] text-left max-w-xs ${severityColors[data.severity] || "border-border bg-card"}`}>
			<Handle type="target" position={Position.Top} className="w-2 h-2" />
			<div className="flex items-center justify-between gap-2 mb-1.5">
				<Badge variant="outline" className="text-[9px] uppercase tracking-widest py-0 font-bold px-1.5 bg-background">
					{data.severity}
				</Badge>
				{data.verified === true && (
					<Badge variant="outline" className="text-[8px] bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-semibold py-0 gap-0.5">
						<Check className="h-2 w-2" /> Verified
					</Badge>
				)}
				{data.verified === false && (
					<Badge variant="outline" className="text-[8px] bg-red-500/10 border-red-500/50 text-red-600 font-semibold py-0 gap-0.5">
						<AlertCircle className="h-2 w-2" /> Failed
					</Badge>
				)}
			</div>
			<div className="font-semibold text-xs text-foreground mb-1 leading-snug">{data.title}</div>
			<div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{data.description}</div>
		</div>
	);
};

const nodeTypes = {
	pr: PRNode,
	file: FileNode,
	suggestion: SuggestionNode,
};

interface ReviewFlowCanvasProps {
	review: {
		prTitle: string;
		prNumber: number;
		review: string;
	};
}

export default function ReviewFlowCanvas({ review }: ReviewFlowCanvasProps) {
	const parsed = useMemo(() => parseSuggestionsFromReview(review.review ?? ""), [review.review]);

	const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

	useEffect(() => {
		if (!parsed.suggestions.length) {
			setNodes([]);
			setEdges([]);
			return;
		}

		const localNodes: any[] = [];
		const localEdges: any[] = [];

		// 1. Add central PR node
		localNodes.push({
			id: "pr-root",
			type: "pr",
			position: { x: 250, y: 0 },
			data: { title: review.prTitle, prNumber: review.prNumber },
		});

		// Group suggestions by file
		const filesMap = new Map<string, any[]>();
		parsed.suggestions.forEach((s: any) => {
			if (!filesMap.has(s.filePath)) {
				filesMap.set(s.filePath, []);
			}
			filesMap.get(s.filePath)!.push(s);
		});

		const filePaths = Array.from(filesMap.keys());
		const fileWidth = 300;
		const totalWidth = (filePaths.length - 1) * fileWidth;
		const startX = 250 - totalWidth / 2;

		// 2. Add File and Suggestion nodes
		filePaths.forEach((filePath, fileIndex) => {
			const suggestions = filesMap.get(filePath)!;
			const fileNodeId = `file-${fileIndex}`;
			const fileX = startX + fileIndex * fileWidth;
			const fileY = 160;

			// Add File Node
			localNodes.push({
				id: fileNodeId,
				type: "file",
				position: { x: fileX, y: fileY },
				data: { filePath, suggestionCount: suggestions.length },
			});

			// Connect PR to File
			localEdges.push({
				id: `pr-to-${fileNodeId}`,
				source: "pr-root",
				target: fileNodeId,
				type: "smoothstep",
				animated: true,
			});

			// Add Suggestion Nodes below the File Node
			suggestions.forEach((s, suggestionIndex) => {
				const sugNodeId = `sug-${s.id}`;
				const sugX = fileX - 20; // center offset
				const sugY = fileY + 120 + suggestionIndex * 140;

				localNodes.push({
					id: sugNodeId,
					type: "suggestion",
					position: { x: sugX, y: sugY },
					data: {
						title: s.title,
						description: s.description,
						severity: s.severity,
						verified: s.verified,
					},
				});

				// Connect File to Suggestion
				localEdges.push({
					id: `${fileNodeId}-to-${sugNodeId}`,
					source: fileNodeId,
					target: sugNodeId,
					type: "smoothstep",
				});
			});
		});

		setNodes(localNodes);
		setEdges(localEdges);
	}, [parsed, review.prTitle, review.prNumber, setNodes, setEdges]);

	if (nodes.length === 0) {
		return (
			<div className="h-[250px] flex items-center justify-center text-xs text-muted-foreground italic border rounded-lg bg-muted/20">
				No suggestions found to visualize.
			</div>
		);
	}

	return (
		<div className="h-[450px] w-full border rounded-lg overflow-hidden bg-muted/5 relative">
			<Canvas
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
			/>
		</div>
	);
}
