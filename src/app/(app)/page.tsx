import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage(props: {
  searchParams: Promise<{
    lavorateData?: string;
    incMandante?: string;
    incPerimetro?: string;
    incMese?: string;
    gruppo?: string;
    sede?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { default: HomeDashboard } = await import("./homeDashboard");
  return <HomeDashboard {...props} />;
}