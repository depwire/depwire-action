export interface Shape { area(): number; }
export class Circle implements Shape {
  constructor(private r: number) {}
  area(): number { return Math.PI * this.r * this.r; }
}
