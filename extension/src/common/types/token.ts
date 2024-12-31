export interface IdTokenPayload {
  aud: string; // Audience
  azp: string; // Authorized party
  email: string; // Email address
  email_verified: boolean; // Whether email is verified
  exp: number; // Expiration time (in seconds since epoch)
  family_name: string; // Family name (last name)
  given_name: string; // Given name (first name)
  iat: number; // Issued at (in seconds since epoch)
  iss: string; // Issuer
  jti: string; // JWT ID
  name: string; // Full name
  nbf: number; // Not before (in seconds since epoch)
  nonce: string; // Nonce
  picture: string; // URL of the user's profile picture
  sub: string; // Subject (user ID)
}

export interface IdTokenData {
  idToken: string;
  idTokenPayload: IdTokenPayload;
}