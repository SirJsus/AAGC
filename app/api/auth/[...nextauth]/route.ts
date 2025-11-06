import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Ensure Node runtime so NextAuth internals receive a Node-style request
// (with `query`). Export the handler directly which is the recommended
// pattern for the App Router.
export const runtime = "nodejs";

const handler = NextAuth(authOptions as any);

export { handler as GET, handler as POST };
