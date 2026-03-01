export type AuthUser = {
  id: string;
  email: string;
  username: string;
};

export type AuthSuccessResponse = {
  token: string;
  user: AuthUser;
};
