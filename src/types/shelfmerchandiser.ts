export interface SMRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  travelTimeEnabled: boolean;
  visitCount?: number;
  createdAt: string;
  password?: string;
}
