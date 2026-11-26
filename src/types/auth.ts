export const ROLES = ['student', 'mentor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Set on `req.user` by the auth middleware (foundation step). Role always comes from `profiles`. */
export interface AuthUser {
  id: string;
  role: Role;
}
