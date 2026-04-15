import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    access_token?: string;
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      team_id?: string | null;
      cuebi_role?: string;
      org_id?: string;
      cuebi_user_id?: string;
    };
  }

  interface User {
    access_token?: string;
    team_id?: string | null;
    cuebi_role?: string;
    org_id?: string;
    cuebi_user_id?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    team_id?: string | null;
    cuebi_role?: string;
    org_id?: string;
    cuebi_user_id?: string;
  }
}
