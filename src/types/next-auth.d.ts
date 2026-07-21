import type { DefaultSession } from "next-auth";

type Role = "STUDENT" | "TEACHER" | "ADMIN";

declare module "next-auth" {
  interface User {
    role: Role;
    language: string;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      language: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    language: string;
  }
}
