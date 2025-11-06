import { Role } from "@prisma/client";
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: Role;
      clinicId: string | null;
      clinicName: string | null;
      isActive: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    clinicId: string | null;
    clinicName: string | null;
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    clinicId: string | null;
    clinicName: string | null;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }
}
