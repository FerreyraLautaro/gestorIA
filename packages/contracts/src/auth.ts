/** Body of `POST /auth/register`. */
export interface RegisterRequest {
  email: string;
  password: string;
  businessName: string;
}

/** Body of `POST /auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Response of `POST /auth/login`: a short-lived signed JWT. */
export interface LoginResponse {
  accessToken: string;
}
