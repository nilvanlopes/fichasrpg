const assetRoot = "/assets/systems/mutantes";

export const mutantes = {
  id: "mutantes",
  label: "Mutantes & Malfeitores",
  shortLabel: "Mutantes",
  nameField: "nome-personagem",
  cover: `${assetRoot}/cover.jpg`,
  logo: { src: `${assetRoot}/logo.png` },
  readLegacyForm(user, form) {
    if (user?.username !== "pyu" || Object.keys(form || {}).length) return null;
    try {
      const legacy = JSON.parse(localStorage.getItem("ficha-mutantes-malfeitores-react-v1") || "null");
      return legacy && typeof legacy === "object" && !Array.isArray(legacy) && Object.keys(legacy).length
        ? legacy
        : null;
    } catch {
      return null;
    }
  },
};
