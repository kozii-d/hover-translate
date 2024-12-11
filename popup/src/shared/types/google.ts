export const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_ISSUER = "https://accounts.google.com";

export interface GoogleTokenPayload {
  iss: string; // Issuer
  azp: string; // Authorized party
  aud: string; // Audience
  sub: string; // Subject
  email: string; // Email address
  email_verified: boolean; // Email verification status
  nonce: string; // Nonce
  nbf: number; // Not before (timestamp in seconds)
  name: string; // Full name
  picture: string; // URL to profile picture
  given_name: string; // Given name (first name)
  family_name: string; // Family name (last name)
  iat: number; // Issued at (timestamp in seconds)
  exp: number; // Expiration time (timestamp in seconds)
  jti: string; // JWT ID (unique identifier for the token)
}