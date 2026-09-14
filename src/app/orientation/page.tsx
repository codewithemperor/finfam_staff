import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Continue your application",
};

/**
 * Orientation is a stage of one application journey — not a standalone
 * product. Candidates enter through "Continue Application", which resolves
 * their application and takes them to their current stage.
 */
export default function OrientationEntryPage() {
  redirect("/continue");
}
