export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  isSuspended: boolean;
  isEmailVerified: boolean;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type PrismaTransactionClient = Omit<
  import('@prisma/client').PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
