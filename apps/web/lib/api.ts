import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL, timeout: 60000 });

/** Called by SessionSync whenever the NextAuth session changes. */
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

// ── Types ──

export interface Connection {
  id: string;
  name: string;
  conn_type: string;
  host?: string;
  port?: number;
  database_name?: string;
  status: string;
  last_synced_at?: string;
  created_at: string;
}

export interface QueryResponse {
  query_id: string;
  question: string;
  sql: string;
  explanation: string;
  columns: string[];
  rows: any[][];
  row_count: number;
  chart: { chart_type: string; echarts_option?: any } | null;
  summary: string;
  suggested_questions: string[];
  duration_ms: number;
  llm_provider: string;
}

export interface SchemaTable {
  table_name: string;
  sql_name: string;           // schema-qualified: "analytics.dim_students"
  dbt_schema: string;         // e.g. "analytics" — empty if not dbt
  source: "introspection" | "dbt";
  lineage: string[];          // parent model names
  columns: {
    column_name: string;
    data_type: string;
    description: string;
    is_primary_key: boolean;
    foreign_key?: string;
  }[];
}

export interface DbtStatus {
  configured: boolean;
  dbt_type?: "manifest" | "cloud";
  sync_status?: "pending" | "syncing" | "ready" | "error";
  model_count?: number;
  last_synced_at?: string;
  sync_error?: string;
}

export interface Schedule {
  id: string;
  name: string;
  cron_expression: string;
  format: string;
  timezone: string;
  is_active: boolean;
  last_run_at?: string;
  question?: string;
  created_at: string;
}

export interface Alert {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  column_name: string;
  check_interval_minutes: number;
  is_active: boolean;
  last_triggered_at?: string;
  question?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by_name?: string;
  created_at: string;
  expires_at: string;
}

// ── Connections ──
export const testConnection = (data: any) => api.post("/api/connections/test", data);
export const createConnection = (data: any) => api.post<Connection>("/api/connections", data);
export const listConnections = () => api.get<Connection[]>("/api/connections");
export const syncConnection = (id: string) => api.post(`/api/connections/${id}/sync`);
export const getConnection = (id: string) => api.get<Connection>(`/api/connections/${id}`);

// ── Query ──
export const runQuery = (data: { question: string; connection_id: string; llm_provider?: string }) =>
  api.post<QueryResponse>("/api/query", { llm_provider: "openai", ...data });
export const listQueries = (limit?: number) => api.get(`/api/queries?limit=${limit || 20}`);

// ── Schema ──
export const getSchema = (connectionId: string) => api.get<SchemaTable[]>(`/api/schema/${connectionId}`);

// ── dbt Integration ──
export const getDbtStatus = (connectionId: string) =>
  api.get<DbtStatus>(`/api/connections/${connectionId}/dbt/status`);

export const uploadDbtManifest = (connectionId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/api/connections/${connectionId}/dbt/manifest`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const configureDbtCloud = (connectionId: string, data: {
  account_id: string; project_id: string; environment_id?: string; api_token: string;
}) => api.post(`/api/connections/${connectionId}/dbt/cloud`, data);

export const syncDbtCloud = (connectionId: string) =>
  api.post(`/api/connections/${connectionId}/dbt/sync`);

// ── Dashboard ──
export const pinQuery = (queryId: string, name?: string) =>
  api.post("/api/dashboard/pin", { query_id: queryId, name: name || "" });
export const unpinQuery = (queryId: string) =>
  api.delete(`/api/dashboard/pin/${queryId}`);
export const listPinned = () => api.get("/api/dashboard/pinned");

// ── SQL Explain ──
export const explainSQL = (sql: string, llmProvider?: string) =>
  api.post<{ sql: string; explanation: string }>("/api/explain-sql", { sql, llm_provider: llmProvider || "openai" });

// ── Scheduled Reports ──
export const createSchedule = (data: {
  name: string; query_id: string; cron_expression: string;
  recipients?: string[]; format?: string;
}) => api.post<Schedule>("/api/reports/schedules", data);
export const listSchedules = () => api.get<Schedule[]>("/api/reports/schedules");
export const deleteSchedule = (id: string) => api.delete(`/api/reports/schedules/${id}`);
export const toggleSchedule = (id: string) => api.patch(`/api/reports/schedules/${id}/toggle`);

// ── Alerts ──
export const createAlert = (data: {
  name: string; query_id: string; condition: string;
  threshold: number; column_name: string; check_interval_minutes?: number;
  notify_emails?: string[];
}) => api.post<Alert>("/api/reports/alerts", data);
export const listAlerts = () => api.get<Alert[]>("/api/reports/alerts");
export const deleteAlert = (id: string) => api.delete(`/api/reports/alerts/${id}`);

// ── Teams ──
export const listMembers = () => api.get<TeamMember[]>("/api/teams/members");
export const updateMemberRole = (userId: string, role: string) =>
  api.patch(`/api/teams/members/${userId}/role`, { role });
export const removeMember = (userId: string) =>
  api.delete(`/api/teams/members/${userId}`);
export const getMyExamples = () => api.get<string[]>("/api/teams/my/examples");

// ── Admin ──
export const adminListTeams = () => api.get("/api/admin/teams");
export const adminCreateTeam = (name: string, description?: string) =>
  api.post("/api/admin/teams", { name, description });
export const adminDeleteTeam = (teamId: string) =>
  api.delete(`/api/admin/teams/${teamId}`);
export const adminListTeamMembers = (teamId: string) =>
  api.get(`/api/admin/teams/${teamId}/members`);
export const adminProvisionMember = (teamId: string, email: string, name?: string, role?: string) =>
  api.post(`/api/admin/teams/${teamId}/members`, { email, name, role: role || "analyst" });
export const adminRemoveFromTeam = (teamId: string, userId: string) =>
  api.delete(`/api/admin/teams/${teamId}/members/${userId}`);
export const adminListSchemas = (teamId: string) =>
  api.get(`/api/admin/teams/${teamId}/schemas`);
export const adminAddSchema = (teamId: string, tableName: string) =>
  api.post(`/api/admin/teams/${teamId}/schemas`, { table_name: tableName });
export const adminRemoveSchema = (teamId: string, accessId: string) =>
  api.delete(`/api/admin/teams/${teamId}/schemas/${accessId}`);
export const adminListExamples = (teamId: string) =>
  api.get(`/api/admin/teams/${teamId}/examples`);
export const adminAddExample = (teamId: string, question: string, sortOrder?: number) =>
  api.post(`/api/admin/teams/${teamId}/examples`, { question, sort_order: sortOrder || 0 });
export const adminDeleteExample = (teamId: string, exampleId: string) =>
  api.delete(`/api/admin/teams/${teamId}/examples/${exampleId}`);
export const adminListUsers = () => api.get("/api/admin/users");
export const adminUsageStats = () => api.get("/api/admin/usage");
export const adminListConnectionTables = (connectionId: string) =>
  api.get(`/api/admin/connections/${connectionId}/tables`);

export default api;
