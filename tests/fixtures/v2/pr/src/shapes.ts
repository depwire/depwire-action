export interface Shape { area(): number; }
export class Circle implements Shape {
  constructor(private r: number) {}
  area(): number { return Math.PI * this.r * this.r; }
}
export abstract class Polygon implements Shape {
  abstract sides(): number;
  area(): number { return 0; }
}
export class Square extends Polygon {
  constructor(private s: number) { super(); }
  area(): number { return this.s * this.s; }
}
