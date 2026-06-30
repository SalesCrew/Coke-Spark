export interface GMRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  region: string;
  ipp: number;
  ippSampleCount?: number;
  isBillaGm?: boolean;
  isActive?: boolean;
  deletedAt?: string | null;
  anonymizedAt?: string | null;
  createdAt: string;
  password?: string;
}
