import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Content Cleaner Tool",
  description:
    "Upload your AI-generated images, texts or videos and remove all traces of artificial origin. Free, instant and private.",
  openGraph: {
    title: "IAKiller — AI Content Cleaner Tool",
    description:
      "Upload your AI-generated images, texts or videos and remove all traces of artificial origin. Free, instant and private.",
  },
};

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
