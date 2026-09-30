import { Circle, Shape } from './shapes';
function render(s: Shape): string { return `area ${s.area()}`; }
const c = new Circle(2);
function main() {
  if (c) {
    const label = render(c);
    console.log(label);
  }
}
main();
