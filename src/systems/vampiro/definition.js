import { legacyVampireForm } from "./legacyImport.js";

const assetRoot = "/assets/systems/vampiro";

export const vampiro = {
  id: "vampiro",
  label: "Vampiro: A Máscara",
  shortLabel: "Vampiro",
  nameField: "nome",
  cover: `${assetRoot}/cover.jpg`,
  logo: { src: `${assetRoot}/images/frame.png`, viewBox: "850 0 670 245", width: 2342, height: 3444 },
  importLegacyForm: legacyVampireForm,
};
