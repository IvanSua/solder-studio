export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referralCode?: string;
  newsletterOptIn?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
  /** True when the user has 2FA enabled — client must call /2fa/verify */
  requiresTwoFactor?: boolean;
  /** Short-lived token for the 2FA verify step */
  tempToken?: string;
}

export interface UserInfo {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  cuit?: string;
  role: string;
  enabled?: boolean;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  createdAt?: string;
}
