export type UserRole =
  | "shelf_merchandiser"
  | "territory_manager"
  | "sm_admin"
  | "gm_admin"
  | "super_admin";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  team_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
