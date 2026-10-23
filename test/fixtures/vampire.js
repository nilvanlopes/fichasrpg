// Independent snapshot of the original sheet's field names and scalar types.
const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
export const vampireTextFields = [
  "nome", "conceito", "predador", "cronica", "ambicao", "cla", "senhor", "desejo", "geracao",
  "armasbrancas", "armasdefogo", "atletismo", "briga", "conducao", "furtividade", "ladroagem", "oficios", "sobrevivencia",
  "empatiacomanimais", "etiqueta", "intimidacao", "lideranca", "manha", "performance", "persuasao", "sagacidade", "subterfugio",
  "ciencia", "erudicao", "financas", "investigacao", "medicina", "ocultismo", "percepcao", "politica", "tecnologia",
  ...range(1, 9).flatMap(index => [`nd${index}`, ...range(1, 5).map(level => `hd${index}${level}`)]),
  "ressonancia", ...range(1, 10).flatMap(index => [`v${index}`, `d${index}`]),
  "ss", "qr", "bp", "rs", "pa", "gp", "et", "eg", "anotacoes",
];
export const vampireDotFields = [...range(1, 209), ...range(230, 289), ...range(300, 365)].map(index => `rd${index}`);
export const vampireTrackFields = range(1, 35).map(index => `es${index}`);

export function vampireForm() {
  return {
    ...Object.fromEntries(vampireTextFields.map(name => [name, `${name}: ação, memória e sangue\nSegunda linha`])),
    ...Object.fromEntries(vampireDotFields.map((name, index) => [name, index % 2 === 0])),
    ...Object.fromEntries(vampireTrackFields.map((name, index) => [name, index < 20 ? String(index % 4 + 1) : "4"])),
    "vampire-theme": "dark",
  };
}
