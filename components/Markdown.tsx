import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/components/ui";

const components: Components = {
  h1: (props) => <h1 className="mt-8 mb-4 text-2xl font-bold text-slate-900" {...props} />,
  h2: (props) => <h2 className="mt-8 mb-3 text-xl font-bold text-slate-900" {...props} />,
  h3: (props) => <h3 className="mt-6 mb-2 text-lg font-semibold text-slate-900" {...props} />,
  p: (props) => <p className="my-4 leading-7 text-slate-700" {...props} />,
  ul: (props) => <ul className="my-4 list-disc space-y-1 pl-6 text-slate-700" {...props} />,
  ol: (props) => <ol className="my-4 list-decimal space-y-1 pl-6 text-slate-700" {...props} />,
  li: (props) => <li className="leading-7" {...props} />,
  a: ({ href, ...props }) => (
    <a
      href={href}
      className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote className="my-4 border-l-4 border-indigo-200 pl-4 italic text-slate-600" {...props} />
  ),
  pre: (props) => (
    <pre className="my-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100" {...props} />
  ),
  code: ({ className, ...props }) => (
    <code className={cn("font-mono text-[0.9em]", className)} {...props} />
  ),
  hr: (props) => <hr className="my-8 border-slate-200" {...props} />,
  strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
  table: (props) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold" {...props} />
  ),
  td: (props) => <td className="border border-slate-200 px-3 py-2" {...props} />,
};

/** Render trusted Markdown (admin-authored blog content) with consistent styling. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
