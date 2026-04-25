import { redirect } from "next/navigation";

export default function ContributionsRedirect() {
  redirect("/portfolio?tab=contributions");
}
