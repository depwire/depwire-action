import { Square, Shape } from './shapes';
export function helper(i: number): string { return `h${i}`; }
export function describe(s: Shape): string {
  for (let i = 0; i < 1; i++) {
    const tag = helper(i);
    if (tag) { return tag + s.area(); }
  }
  return '';
}
export const sq = new Square(3);

export function blockDependency(): string {
  if (true) {
    function nested(): string { return helper(1); }
    return nested();
  }
  return '';
}
