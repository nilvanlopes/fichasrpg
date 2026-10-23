// Keep the original field keys so saved sheets and legacy JSON remain compatible.
export const pointFields = (start, count = 5) => Array.from({ length: count }, (_, index) => `rd${start + index}`);
export const trackFields = (start, count) => Array.from({ length: count }, (_, index) => `es${start + index}`);

export const identityFields = [
  ["nome", "Nome"], ["conceito", "Conceito"], ["predador", "Predador"],
  ["cronica", "Crônica"], ["ambicao", "Ambição"], ["cla", "Clã"],
  ["senhor", "Senhor"], ["desejo", "Desejo"], ["geracao", "Geração"],
];

export const attributes = [
  { label: "Físicos", traits: [["Força", 1], ["Destreza", 6], ["Vigor", 11]] },
  { label: "Sociais", traits: [["Carisma", 16], ["Manipulação", 21], ["Autocontrole", 26]] },
  { label: "Mentais", traits: [["Inteligência", 31], ["Raciocínio", 36], ["Determinação", 41]] },
];

export const skills = [
  { label: "Físicas", traits: [
    ["Armas Brancas", "armasbrancas", 46], ["Armas de Fogo", "armasdefogo", 51],
    ["Atletismo", "atletismo", 56], ["Briga", "briga", 61], ["Condução", "conducao", 66],
    ["Furtividade", "furtividade", 71], ["Ladroagem", "ladroagem", 76],
    ["Ofícios", "oficios", 346], ["Sobrevivência", "sobrevivencia", 81],
  ] },
  { label: "Sociais", traits: [
    ["Empatia com Animais", "empatiacomanimais", 86], ["Etiqueta", "etiqueta", 91],
    ["Intimidação", "intimidacao", 96], ["Liderança", "lideranca", 101], ["Manha", "manha", 106],
    ["Performance", "performance", 111], ["Persuasão", "persuasao", 116],
    ["Sagacidade", "sagacidade", 121], ["Subterfúgio", "subterfugio", 126],
  ] },
  { label: "Mentais", traits: [
    ["Ciência", "ciencia", 131], ["Erudição", "erudicao", 136], ["Finanças", "financas", 141],
    ["Investigação", "investigacao", 146], ["Medicina", "medicina", 151],
    ["Ocultismo", "ocultismo", 156], ["Percepção", "percepcao", 161],
    ["Política", "politica", 166], ["Tecnologia", "tecnologia", 171],
  ] },
];

export const disciplines = Array.from({ length: 9 }, (_, index) => ({
  name: `nd${index + 1}`,
  powers: Array.from({ length: 5 }, (_, power) => `hd${index + 1}${power + 1}`),
  points: pointFields(index < 6 ? 176 + index * 5 : 351 + (index - 6) * 5),
}));

// The gaps in these ranges are part of the legacy format, including rd230 and rd300.
export const advantages = Array.from({ length: 10 }, (_, index) => ({
  name: `v${index + 1}`,
  points: index === 0 ? [...pointFields(206, 4), "rd230"] : pointFields(226 + index * 5),
}));
export const flaws = Array.from({ length: 10 }, (_, index) => ({
  name: `d${index + 1}`,
  points: index === 2 ? [...pointFields(286, 4), "rd300"] : pointFields(index < 2 ? 276 + index * 5 : 286 + index * 5),
}));

export const bloodFields = [
  ["ss", "Surto de Sangue"], ["qr", "Quantidade Recuperada"], ["bp", "Bônus de Poder"],
  ["rs", "Rerrolagem de Sangue"], ["pa", "Penalidade de Alimentação"], ["gp", "Gravidade da Perdição"],
];

export const trackStates = {
  damage: ["1", "2", "3", "4"],
  hunger: ["1", "4"],
  humanity: ["1", "2", "4"],
};

export function trackValue(value, kind) {
  const state = String(value ?? "1");
  return trackStates[kind].includes(state) ? state : "1";
}

export function nextTrackValue(value, kind) {
  const states = trackStates[kind];
  return states[(states.indexOf(trackValue(value, kind)) + 1) % states.length];
}
