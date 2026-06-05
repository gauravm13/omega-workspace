import { getServerSession } from "next-auth/next";
import { authOptions } from "@/infrastructure/auth/authOptions";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // If authenticated, route to the application domain.
  // If not, NextAuth handles the interception (we will build the UI next).
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Omega Workspace</h1>
        <p className="text-gray-500">Unauthenticated State: Identity Verification Required.</p>
        <a 
          href="/api/auth/signin" 
          className="inline-block bg-black text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors"
        >
          Initialize SSO Simulation
        </a>
      </div>
    </main>
  );
}