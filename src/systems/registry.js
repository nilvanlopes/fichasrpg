import { mutantes } from "./mutantes/definition.js";
import { vampiro } from "./vampiro/definition.js";

// Plain definitions can also be used by file utilities and Node tests.
export const systems = { vampiro, mutantes };

export function getSystem(id) {
  return Object.hasOwn(systems, id) ? systems[id] : undefined;
}
