export interface SMRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  region: string;
  visitCount?: number;
  createdAt: string;
  password?: string;
}
