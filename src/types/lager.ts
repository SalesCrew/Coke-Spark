export type LagerRecord = {
  id: string;
  address: string;
  postalCode: string;
  city: string;
  gmUserId: string | null;
  gmName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateLagerInput = {
  address: string;
  postalCode: string;
  city: string;
  gmUserId?: string | null;
};
