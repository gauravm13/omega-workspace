import { getServerSession } from "next-auth/next";
import { authOptions } from "@/infrastructure/auth/authOptions";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // If authenticated, safely route to the application dashboard domain.
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900">
      <div className="text-center space-y-6 max-w-md p-6 bg-white border rounded-xl shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight text-black">Omega Workspace</h1>
        <p className="text-gray-500 text-sm">
          Enterprise Cloud Instance Live. Identity verification is required to mount the workspace context.
        </p>
        
        {/* FIX: Explicitly direct NextAuth to return to the correct production domain post-auth */}
        <a 
          href="/api/auth/signin?callbackUrl=/dashboard" 
          className="inline-block w-full bg-black text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors"
        >
          Initialize SSO Simulation
        </a>
      </div>
    </main>
  );
}