export type LagerRecord = {
  id: string;
  address: string;
  postalCode: string;
  city: string;
  gmUserIds: string[];
  gmNames: string[];
  gmUserId: string | null;
  gmName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateLagerInput = {
  address: string;
  postalCode: string;
  city: string;
  gmUserIds?: string[];
  gmUserId?: string | null;
};

export type UpdateLagerInput = {
  id: string;
  address: string;
  postalCode: string;
  city: string;
  gmUserIds?: string[];
  gmUserId?: string | null;
};
