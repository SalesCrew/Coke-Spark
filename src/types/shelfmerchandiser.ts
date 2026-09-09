export interface SMRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  travelTimeEnabled: boolean;
  visitCount?: number;
  createdAt: string;
  password?: string;
}
