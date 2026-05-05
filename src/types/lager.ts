export type LagerRecord = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  gmUserId: string | null;
  gmName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateLagerInput = {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  gmUserId?: string | null;
};
