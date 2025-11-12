import type { User } from './user';

export function getUserInitials(user: User): string {
  if (user.name) {
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (user.email) {
    const firstChar = user.email[0];
    return firstChar ? firstChar.toUpperCase() : 'A';
  }
  return 'A'; // Anonymous
}
