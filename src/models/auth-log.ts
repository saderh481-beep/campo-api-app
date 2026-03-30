export interface AuthLog {
  id: string;
  actor_id: string;
  actor_tipo: string;
  accion: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}
