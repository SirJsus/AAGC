
import { Role } from "@prisma/client"
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      role: Role
      clinicId: string | null
      clinicName: string | null
    }
  }

  interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: Role
    clinicId: string | null
    clinicName: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    clinicId: string | null
    clinicName: string | null
    firstName: string
    lastName: string
  }
}
