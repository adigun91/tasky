export interface UserProfile {
  name: string;
  email: string;
  avatarColor: string;
}

export const AVATAR_COLORS: string[] = [
  '#4F46E5',
  '#DC2626',
  '#059669',
  '#D97706',
  '#DB2777',
  '#0891B2',
];

export const DEFAULT_PROFILE: UserProfile = {
  name: 'You',
  email: '',
  avatarColor: AVATAR_COLORS[0],
};
