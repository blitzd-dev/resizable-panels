import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type FileNode = { type: "file"; name: string; ext?: Ext };
type FolderNode = {
  type: "dir";
  name: string;
  children: TreeNode[];
  openByDefault?: boolean;
};
type TreeNode = FileNode | FolderNode;

type Ext = "tsx" | "ts" | "json" | "md" | "css";

const DEFAULT_TREE: TreeNode[] = [
  {
    type: "dir",
    name: "src",
    openByDefault: true,
    children: [
      {
        type: "dir",
        name: "components",
        openByDefault: true,
        children: [
          { type: "file", name: "Panel.tsx", ext: "tsx" },
          { type: "file", name: "PanelGroup.tsx", ext: "tsx" },
          { type: "file", name: "Resizer.tsx", ext: "tsx" },
        ],
      },
      { type: "file", name: "App.tsx", ext: "tsx" },
      { type: "file", name: "main.tsx", ext: "tsx" },
      { type: "file", name: "index.css", ext: "css" },
    ],
  },
  { type: "file", name: "package.json", ext: "json" },
  { type: "file", name: "tsconfig.json", ext: "json" },
  { type: "file", name: "README.md", ext: "md" },
];

/** Nodes rendered before this one in a full depth-first expansion — drives
 *  the per-row reveal stagger. */
const countNodes = (node: TreeNode): number =>
  node.type === "file"
    ? 1
    : 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);

export type FileTreeProps = {
  /** Tree to render. Falls back to a representative React project. */
  tree?: TreeNode[];
  /** File highlighted as the active tab in the editor. Match by filename. */
  activeFile?: string;
  /** Present when the tree is interactive: clicking a file opens it. */
  onOpenFile?: (name: string) => void;
  /** Header label. Defaults to the project folder name. */
  projectName?: string;
};

export function FileTree({
  tree = DEFAULT_TREE,
  activeFile = "App.tsx",
  onOpenFile,
  projectName = "resizable-panels",
}: FileTreeProps) {
  let order = 0;
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border">
        <div className="px-3 pt-1.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70">
          Explorer
        </div>
        <div className="flex items-center gap-1 px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/85">
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{projectName}</span>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1 text-xs">
          {tree.map((node) => {
            const start = order;
            order += countNodes(node);
            return (
              <TreeRow
                key={node.name}
                node={node}
                depth={0}
                order={start}
                activeFile={activeFile}
                onOpenFile={onOpenFile}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function RowReveal({
  order,
  children,
}: {
  order: number;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + order * 0.04, duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
}

function TreeRow({
  node,
  depth,
  order,
  activeFile,
  onOpenFile,
}: {
  node: TreeNode;
  depth: number;
  order: number;
  activeFile: string;
  onOpenFile?: (name: string) => void;
}) {
  if (node.type === "file") {
    const isActive = node.name === activeFile;
    return (
      <RowReveal order={order}>
        <Button
          variant="ghost"
          size="xs"
          onClick={onOpenFile ? () => onOpenFile(node.name) : undefined}
          className={cn(
            "h-auto w-full justify-start gap-1.5 rounded-none px-2 py-0.5 text-left text-xs font-normal text-foreground/80",
            isActive
              ? "bg-accent text-foreground hover:bg-accent"
              : "hover:bg-accent/50",
            !onOpenFile && "pointer-events-none",
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <FileIcon ext={node.ext} />
          <span className="truncate">{node.name}</span>
        </Button>
      </RowReveal>
    );
  }
  return (
    <DirRow
      node={node}
      depth={depth}
      order={order}
      activeFile={activeFile}
      onOpenFile={onOpenFile}
    />
  );
}

function DirRow({
  node,
  depth,
  order,
  activeFile,
  onOpenFile,
}: {
  node: FolderNode;
  depth: number;
  order: number;
  activeFile: string;
  onOpenFile?: (name: string) => void;
}) {
  const [open, setOpen] = useState(node.openByDefault ?? false);
  let childOrder = order + 1;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <RowReveal order={order}>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="h-auto w-full justify-start rounded-none px-2 py-0.5 text-left text-foreground/80 hover:bg-accent/50"
              style={{ paddingLeft: 4 + depth * 12 }}
            />
          }
        >
          {open ? (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          )}
          {open ? (
            <FolderOpen className="size-3.5 shrink-0 text-sky-400/80" />
          ) : (
            <Folder className="size-3.5 shrink-0 text-sky-400/80" />
          )}
          <span className="truncate">{node.name}</span>
        </CollapsibleTrigger>
      </RowReveal>
      <CollapsibleContent>
        {node.children.map((child) => {
          const start = childOrder;
          childOrder += countNodes(child);
          return (
            <TreeRow
              key={child.name}
              node={child}
              depth={depth + 1}
              order={start}
              activeFile={activeFile}
              onOpenFile={onOpenFile}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FileIcon({ ext }: { ext?: Ext }) {
  const cls = "size-3.5 shrink-0";
  switch (ext) {
    case "tsx":
    case "ts":
      return <FileCode2 className={cn(cls, "text-cyan-400/80")} />;
    case "json":
      return <FileJson className={cn(cls, "text-amber-400/80")} />;
    case "md":
      return <FileText className={cn(cls, "text-muted-foreground")} />;
    case "css":
      return <FileCode2 className={cn(cls, "text-pink-400/80")} />;
    default:
      return <File className={cn(cls, "text-muted-foreground")} />;
  }
}
